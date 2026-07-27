// Render pipeline: ffmpeg orchestration for a project timeline — asset
// collection, clip formatting, concat, audio mix and ASS subtitle burn.
// All server state (projects, tasks, logging) is injected via RenderDeps so
// the pipeline is importable and testable without starting Express.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { generateAss, splitTextIntoTikTokSubtitles } from "../lib/subtitleLayout";
import { isSafeMediaFilename } from "./pathSafety";

export interface BgmFileEntry {
  file: string;
  name: string;
  tags?: string[];
}

export interface MusicItem {
  id: string;
  provider: string;
  url: string;
  title: string;
  duration_sec: number;
  volume: number;
}

// Structural subset of ProjectsRepo/Map — the renderer only reads and updates.
export interface ProjectsStore {
  get(id: string): any | undefined;
  set(id: string, project: any): unknown;
}

export interface RenderDeps {
  projects: ProjectsStore;
  tasks: Map<string, any>;
  logTask: (taskId: string, level: "INFO" | "SUCCESS" | "WARNING" | "ERROR", category: string, message: string) => void;
  localVideosDir: string;
  bgmFiles: BgmFileEntry[];
  sanitizeFolderName: (name: string) => string;
  getFormattedDateTime: () => string;
}

export const correctPexelsCdnUrl = (url: string): string =>
  url.includes("images.pexels.com/video-files/")
    ? url.replace("images.pexels.com/video-files/", "videos.pexels.com/video-files/")
    : url;

export const buildFontsConf = (cwd: string, taskId: string): string => `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${path.join(cwd, "public", "fonts")}</dir>
  <dir>${path.join(cwd, "resource", "fonts")}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <cachedir>/tmp/fonts-cache-${taskId}</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>`;

export const escapeAssPathForFilter = (relPath: string): string =>
  relPath.replace(/'/g, "'\\\\''").replace(/:/g, "\\:");

/**
 * How many dB the BGM is attenuated while the narración is speaking.
 * Decided in plans/plan-011b-ffmpeg-mux.md. 0 disables ducking entirely and
 * falls back to a flat amix.
 */
export const DEFAULT_DUCK_DB = 12;

/** dB → sidechaincompress ratio, per plans/plan-011b-ffmpeg-mux.md. */
export const duckDbToRatio = (duckDb: number): number =>
  Math.round(10 ** (duckDb / 20) * 100) / 100;

export const buildAudioMixFilter = (
  hasNarration: boolean,
  hasMusic: boolean,
  voiceVolume: number,
  musicVolume: number,
  duckDb: number = DEFAULT_DUCK_DB
): string => {
  if (hasNarration && hasMusic) {
    if (duckDb <= 0) {
      // Flat mix: BGM sits at a fixed level whether or not the narración is
      // speaking. Kept as the fallback for FFmpeg builds without
      // sidechaincompress.
      return `[1:a]volume=${voiceVolume}[v];[2:a]volume=${musicVolume}[m];[v][m]amix=inputs=2:duration=first[a]`;
    }
    // Side-chain ducking: the narración keys a compressor on the BGM, pulling
    // it down while the voice is present and letting it recover between
    // phrases. [v] is an intermediate label so it cannot be consumed twice —
    // asplit duplicates it for the sidechain key and the final mix.
    const ratio = duckDbToRatio(duckDb);
    return (
      `[1:a]volume=${voiceVolume}[v];` +
      `[2:a]volume=${musicVolume}[m];` +
      `[v]asplit=2[v1][vsc];` +
      `[m][vsc]sidechaincompress=threshold=0.02:ratio=${ratio}:attack=5:release=200[mduck];` +
      `[v1][mduck]amix=inputs=2:duration=first[a]`
    );
  }
  if (hasNarration) {
    return `[1:a]volume=${voiceVolume}[a]`;
  }
  if (hasMusic) {
    return `[1:a]volume=${musicVolume}[a]`;
  }
  return "";
};

/**
 * Flags that bound the audio mix output.
 *
 * The BGM input is opened with `-stream_loop -1`, i.e. infinite. Without an
 * explicit bound, a mix that has BGM but no narración would make ffmpeg write
 * until the disk fills. The narración, when present, provides the bound —
 * either its measured duration or, failing that, `amix=duration=first`.
 */
export const buildMixDurationArgs = (hasNarration: boolean, narrationDuration: number): string => {
  if (narrationDuration > 0) return `-t ${narrationDuration}`;
  // Sin narración el único audio es la BGM en bucle infinito: hay que cortar
  // con el vídeo, que sí es finito.
  if (!hasNarration) return "-shortest";
  // Con narración pero sin duración medida, amix=duration=first ya acota.
  return "";
};

export function pickBgm(opts: {
  bgmType: string;
  bgmFile?: string;
  bgmVolume: number;
  searchSubject: string;
  bgmFiles: BgmFileEntry[];
  randomIndex?: () => number;
}): MusicItem | null {
  const { bgmType, bgmFile, bgmVolume, searchSubject, bgmFiles } = opts;

  if (bgmType === "random" && bgmFiles.length > 0) {
    const randomIdx = opts.randomIndex
      ? opts.randomIndex()
      : Math.floor(Math.random() * bgmFiles.length);
    const randomFile = bgmFiles[randomIdx];
    return {
      id: `bgm_random_${randomIdx}`,
      provider: "local",
      url: randomFile.file,
      title: randomFile.name,
      duration_sec: 180,
      volume: bgmVolume
    };
  }

  if (bgmType === "contextual" && bgmFiles.length > 0) {
    const subject = searchSubject.toLowerCase();
    let bestMatch = bgmFiles[0];
    let maxMatches = -1;
    for (const file of bgmFiles) {
      let matches = 0;
      if (file.tags) {
        for (const tag of file.tags) {
          if (subject.includes(tag.toLowerCase())) {
            matches++;
          }
        }
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = file;
      }
    }
    return {
      id: "bgm_contextual",
      provider: "local",
      url: bestMatch.file,
      title: bestMatch.name,
      duration_sec: 180,
      volume: bgmVolume
    };
  }

  if (bgmFile && bgmType === "file") {
    const matched = bgmFiles.find(f => f.file === bgmFile || f.name === bgmFile);
    return {
      id: "bgm_param",
      provider: "local",
      url: matched ? matched.file : bgmFile,
      title: matched ? matched.name : path.basename(bgmFile),
      duration_sec: 180,
      volume: bgmVolume
    };
  }

  return null;
}

/** Ceiling for a heavy ffmpeg invocation (encode, concat, mix, subtitle burn).
 *  A stalled child is killed rather than wedging the render forever.
 *  Override with RENDER_COMMAND_TIMEOUT_MS. */
export const DEFAULT_COMMAND_TIMEOUT_MS = Number(process.env.RENDER_COMMAND_TIMEOUT_MS) > 0
  ? Number(process.env.RENDER_COMMAND_TIMEOUT_MS)
  : 30 * 60 * 1000;

/** Ceiling for a probe (ffprobe duration, NVENC capability check). These are
 *  sub-second when healthy; a minute means the device or file is wedged. */
export const PROBE_COMMAND_TIMEOUT_MS = 60 * 1000;

export const executeCommand = (cmd: string, timeoutMs: number = DEFAULT_COMMAND_TIMEOUT_MS): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50, timeout: timeoutMs, killSignal: "SIGKILL" }, (error, stdout, stderr) => {
      if (error) {
        let customErrorMsg = `Command failed: ${cmd}\nError: ${error.message}\nStderr: ${stderr}`;
        if ((error as any).killed) {
          customErrorMsg = `El comando superó el límite de ${Math.round(timeoutMs / 1000)}s y fue detenido. Command timed out after ${Math.round(timeoutMs / 1000)}s.`;
        } else if (cmd.includes("ffmpeg") || cmd.includes("ffprobe")) {
          const isFfmpegMissing =
            error.message.includes("not recognized") ||
            error.message.includes("no se reconoce") ||
            error.message.includes("not found") ||
            error.message.includes("ENOENT") ||
            error.code === 127 ||
            error.code === 9009;

          if (isFfmpegMissing) {
            customErrorMsg = `⚠️ [ERROR DE SISTEMA] FFmpeg / FFprobe no está instalado o no se encuentra en el PATH de tu sistema.

Para ejecutar esta aplicación localmente y generar tus videos con éxito, sigue estos pasos:
1. Descarga FFmpeg desde la página oficial: https://ffmpeg.org/download.html
   (En Windows, puedes descargar el build de Gyan.dev. En Mac, puedes usar 'brew install ffmpeg')
2. Extrae el contenido y añade la carpeta 'bin' (que contiene ffmpeg.exe) al PATH de las Variables de Entorno de tu sistema.
3. Cierra tu terminal actual, abre una nueva terminal y vuelve a iniciar tu servidor con 'npm run dev'.

---------------------------------------------------------
FFmpeg / FFprobe is not installed or found in your system's PATH.
To run this application locally and render videos successfully, please:
1. Download FFmpeg from: https://ffmpeg.org/download.html
2. Extract and add the 'bin' directory to your system's PATH environment variable.
3. Restart your development terminal and run 'npm run dev' again.

[Detalle técnico / Technical Detail]: ${error.message}`;
          }
        }
        reject(new Error(customErrorMsg));
        return;
      }
      resolve(stdout);
    });
  });
};

export const downloadFile = async (url: string, destPath: string): Promise<string> => {
  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size > 0) {
      return destPath;
    }
    try {
      fs.unlinkSync(destPath);
    } catch (e) {}
  }

  const correctedUrl = correctPexelsCdnUrl(url);

  let lastError: any = null;
  // Try fetch up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(correctedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        await fs.promises.writeFile(destPath, Buffer.from(buffer));
        return destPath;
      } else {
        throw new Error(`Status ${response.status} ${response.statusText}`);
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Download] Fetch attempt ${attempt} failed for ${correctedUrl}: ${err.message}`);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // Try curl as fallback
  console.log(`[Download] Falling back to curl for ${correctedUrl}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const cmd = `curl -L -f --retry 3 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -o "${destPath}" "${correctedUrl}"`;
      exec(cmd, (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`curl failed: ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    });

    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      return destPath;
    }
  } catch (curlErr: any) {
    console.error(`[Download] curl fallback also failed for ${correctedUrl}:`, curlErr);
    lastError = new Error(`${lastError?.message || ""} (curl fallback also failed: ${curlErr.message})`);
  }

  throw new Error(`Failed to download ${correctedUrl}: ${lastError?.message}`);
};

export function createRenderer(deps: RenderDeps) {
  const { projects, tasks, logTask, localVideosDir, bgmFiles } = deps;

  const runRealRender = async (projectId: string, taskId: string) => {
    const updateTaskState = (progress: number, outputPath: string | null, error: string | null, state: number = 4) => {
      const t = tasks.get(taskId);
      if (t) {
        t.progress = progress;
        t.state = state;
        t.output_path = outputPath;
        t.error = error;
        tasks.set(taskId, t);
      }
    };

    try {
      const p = projects.get(projectId);
      if (!p) {
        throw new Error("Project not found");
      }

      // Dynamic rebuild of local video tracks if isLocalSource is true
      const isLocalSource = (p.params?.video_source === "local" || p.video_source === "local" || (p.selected_media && p.selected_media[0]?.provider === "local"));
      if (isLocalSource) {
        const uniqueFiles: any[] = [];
        const seen = new Set();
        const chosenLocalFiles = p.params?.local_video_files || [];
        console.log(`[Render Rebuild] Rebuilding local video track. chosenLocalFiles:`, chosenLocalFiles);

        if (chosenLocalFiles.length > 0) {
          for (const filename of chosenLocalFiles) {
            // Defensa en profundidad: un proyecto guardado antes de la validación
            // de entrada puede traer un nombre que acabaría en una shell.
            if (!isSafeMediaFilename(filename)) {
              logTask(taskId, "WARNING", "VIDEO_ASSET", `Nombre de archivo local ignorado por no ser válido.`);
              continue;
            }
            const existingMed = (p.selected_media || []).find((m: any) => path.basename(m.source_url || m.asset_url || "") === filename);
            if (existingMed) {
              if (!seen.has(existingMed.source_url)) {
                seen.add(existingMed.source_url);
                if (!existingMed.local_path) {
                  existingMed.local_path = `storage/local_videos/${filename}`;
                }
                uniqueFiles.push(existingMed);
              }
            } else {
              const sourceUrl = `/storage/local_videos/${filename}`;
              if (!seen.has(sourceUrl)) {
                seen.add(sourceUrl);
                const fullDiskPath = path.join(localVideosDir, filename);
                let durationSec = 15;
                if (fs.existsSync(fullDiskPath)) {
                  try {
                    const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullDiskPath}"`, PROBE_COMMAND_TIMEOUT_MS);
                    const d = parseFloat(durationStr.trim());
                    if (!isNaN(d) && d > 0) {
                      durationSec = d;
                    }
                  } catch (e) {
                    console.warn(`[Render Rebuild] Failed to get duration for ${filename}, defaulting to 15s`, e);
                  }
                }
                uniqueFiles.push({
                  id: `${filename}_custom`,
                  provider: "local",
                  source_url: sourceUrl,
                  download_url: sourceUrl,
                  thumbnail_url: "/dist/assets/background.jpg",
                  duration_sec: durationSec,
                  local_path: `storage/local_videos/${filename}`
                });
              }
            }
          }
        } else if (p.selected_media && p.selected_media.length > 0) {
          for (const med of p.selected_media) {
            if (med.source_url && !seen.has(med.source_url)) {
              seen.add(med.source_url);
              uniqueFiles.push(med);
            }
          }
        }

        if (uniqueFiles.length === 0) {
          try {
            const files = fs.readdirSync(localVideosDir);
            const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
            const availableLocalFiles = files.filter(f => videoExtensions.includes(path.extname(f).toLowerCase()));
            const chosenFiles = availableLocalFiles.length > 0 ? availableLocalFiles : ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];

            for (const filename of chosenFiles) {
              const sourceUrl = `/storage/local_videos/${filename}`;
              if (!seen.has(sourceUrl)) {
                seen.add(sourceUrl);
                uniqueFiles.push({
                  id: `${filename}_fallback`,
                  provider: "local",
                  source_url: sourceUrl,
                  download_url: sourceUrl,
                  thumbnail_url: "/dist/assets/background.jpg",
                  duration_sec: 15,
                  local_path: `storage/local_videos/${filename}`
                });
              }
            }
          } catch (e) {
            console.error("[Render Rebuild] Failed to read fallback local videos:", e);
          }
        }

        const defaultLocalVideos = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
        try {
          const filesOnDisk = fs.readdirSync(localVideosDir);
          const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
          const diskFiles = filesOnDisk.filter(f => videoExtensions.includes(path.extname(f).toLowerCase()));
          const hasCustomFilesOnDisk = diskFiles.some(f => !defaultLocalVideos.includes(f));

          if (hasCustomFilesOnDisk && chosenLocalFiles.length === 0) {
            const filteredUnique = uniqueFiles.filter(med => {
              const filename = path.basename(med.source_url || med.asset_url || "");
              return !defaultLocalVideos.includes(filename);
            });

            if (filteredUnique.length > 0) {
              uniqueFiles.length = 0;
              uniqueFiles.push(...filteredUnique);
            }
          }
        } catch (err) {
          console.error("[Render Rebuild] Failed to filter uniqueFiles against disk:", err);
        }

        const audioTrack = p.tracks?.find((tr: any) => tr.type === "audio");
        const audioItems = audioTrack?.items || [];
        const totalDurationSec = audioItems.reduce((acc: number, item: any) => Math.max(acc, Number(item.start_sec) + Number(item.duration_sec)), 0) || 15;

        console.log(`[Render Rebuild] Rebuilding continuous local video track from ${uniqueFiles.length} files for duration ${totalDurationSec}s`);

        let currentStartSec = 0;
        let itemId = 1;
        const videoItems = [];
        while (currentStartSec < totalDurationSec) {
          const medIndex = (itemId - 1) % uniqueFiles.length;
          const med = uniqueFiles[medIndex];
          const rawDuration = Number(med.duration_sec);
          const fullDuration = (isNaN(rawDuration) || rawDuration <= 0) ? 15 : rawDuration;
          const usedDuration = Math.min(fullDuration, totalDurationSec - currentStartSec);

          videoItems.push({
            id: `item_${itemId}`,
            media_id: med.id,
            local_path: med.local_path,
            asset_url: med.source_url,
            thumbnail_url: med.thumbnail_url || "/dist/assets/background.jpg",
            source_url: med.source_url,
            start_sec: currentStartSec,
            duration_sec: usedDuration,
            trim_start_sec: 0,
            trim_end_sec: usedDuration,
            segment_id: null,
            provider: "local"
          });

          currentStartSec += usedDuration;
          itemId++;
        }

        const existingVideoTrack = p.tracks?.find((tr: any) => tr.type === "video");
        if (existingVideoTrack) {
          existingVideoTrack.items = videoItems;
        } else {
          if (!p.tracks) p.tracks = [];
          p.tracks.push({
            id: `track_video_${Date.now()}`,
            type: "video",
            items: videoItems
          });
        }
        projects.set(projectId, p);
      }

      const videoTrack = p.tracks?.find((tr: any) => tr.type === "video");
      const subtitleTrack = p.tracks?.find((tr: any) => tr.type === "subtitle");

      let musicItem = p.selected_music?.[0];

      if (!musicItem) {
        const bgmType = p.params?.bgm_type || p.bgm_type || "none";
        const bgmFile = p.params?.bgm_file || p.bgm_file;
        const bgmVolume = p.params?.bgm_volume !== undefined ? p.params.bgm_volume : (p.bgm_volume !== undefined ? p.bgm_volume : 0.2);

        musicItem = pickBgm({
          bgmType,
          bgmFile,
          bgmVolume,
          searchSubject: `${p.topic || ""} ${p.script || ""}`,
          bgmFiles
        });

        if (musicItem) {
          const modeLabel = bgmType === "random" ? "Random" : bgmType === "contextual" ? "AI Contextual" : "Manual";
          logTask(taskId, "INFO", "AUDIO_MIXER", `BGM Mode: ${modeLabel}. Selected soundtrack: "${musicItem.title}" at volume: ${bgmVolume}`);
        } else {
          logTask(taskId, "INFO", "AUDIO_MIXER", "BGM Mode: None or Disabled.");
        }
      } else {
        logTask(taskId, "INFO", "AUDIO_MIXER", `Using existing selected music: "${musicItem.title}" at volume: ${musicItem.volume || 0.2}`);
      }

      const clips = videoTrack?.items || [];
      if (clips.length === 0) {
        throw new Error("No video clips in the timeline to render.");
      }

      // Ensure we have a project_folder_name
      if (!p.project_folder_name) {
        const themeFolder = deps.sanitizeFolderName(p.params?.video_niche || p.topic || 'general');
        const folderName = `${deps.sanitizeFolderName(p.topic || p.project_id || 'project')}_${deps.getFormattedDateTime()}`;
        p.project_folder_name = `${themeFolder}/${folderName}`;
        projects.set(projectId, p);
      }

      const projectFolder = path.join(process.cwd(), "storage", "renders", p.project_folder_name);
      const cacheDir = path.join(projectFolder, "cache");
      const renderDir = projectFolder;
      await fs.promises.mkdir(cacheDir, { recursive: true });
      await fs.promises.mkdir(renderDir, { recursive: true });

      logTask(taskId, "INFO", "SUBTITLES", "Generating subtitles");
      await new Promise(r => setTimeout(r, 600));
      logTask(taskId, "SUCCESS", "SUBTITLES", "Subtitles ready");

      // Update progress to 10%
      updateTaskState(10, null, null);

      logTask(taskId, "INFO", "VIDEO_ASSET", "Collecting video materials");

      const localVideoPaths: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const url = clip.source_url || clip.asset_url;
        if (!url) {
          logTask(taskId, "WARNING", "VIDEO_ASSET", `Clip ${clip.id} has no source URL. Generating synthetic placeholder...`);
          localVideoPaths.push("placeholder");
          continue;
        }

        const isLocalUrl = url.startsWith("/") || !url.includes("://") || url.includes("/storage/local_videos/") || url.includes("/local_videos/");
        if (isLocalUrl) {
          const cleanUrl = url.split("?")[0];
          const filename = path.basename(cleanUrl);

          // Try diskPath 1 (relative to cwd)
          let cleanLocalPath = cleanUrl.startsWith("/") ? cleanUrl.slice(1) : cleanUrl;
          if (url.includes("/storage/local_videos/")) {
            cleanLocalPath = `storage/local_videos/${filename}`;
          } else if (url.includes("/local_videos/")) {
            cleanLocalPath = `local_videos/${filename}`;
          }
          const diskPath = path.join(process.cwd(), cleanLocalPath);
          if (fs.existsSync(diskPath)) {
            localVideoPaths.push(diskPath);
            continue;
          }

          // Try diskPath 2 (fallback directly in localVideosDir)
          const fallbackPath = path.join(localVideosDir, filename);
          if (fs.existsSync(fallbackPath)) {
            localVideoPaths.push(fallbackPath);
            continue;
          }

          // Robust safety net fallback: use any existing local video file if the chosen one is missing
          try {
            const availableFiles = fs.readdirSync(localVideosDir).filter(f =>
              [".mp4", ".mkv", ".avi", ".mov", ".webm"].includes(path.extname(f).toLowerCase())
            );
            if (availableFiles.length > 0) {
              const safeFallbackPath = path.join(localVideosDir, availableFiles[0]);
              console.log(`[Renderer] Selected file ${filename} missing. Falling back to available file: ${availableFiles[0]}`);
              logTask(taskId, "WARNING", "VIDEO_ASSET", `El archivo local "${filename}" no fue encontrado. Usando archivo "${availableFiles[0]}" como respaldo.`);
              localVideoPaths.push(safeFallbackPath);
              continue;
            }
          } catch (e) {
            console.error("[Renderer] Failed to list fallback local videos:", e);
          }
        }

        const cleanUrl = url.split("?")[0];
        const ext = path.extname(cleanUrl) || ".mp4";
        const urlHash = crypto.createHash("md5").update(url).digest("hex");
        const dest = path.join(cacheDir, `clip_${clip.id}_${urlHash}${ext}`);

        try {
          await downloadFile(url, dest);
          localVideoPaths.push(dest);
        } catch (downloadErr: any) {
          console.error(`[Renderer] Failed to download clip ${clip.id}:`, downloadErr);
          logTask(taskId, "WARNING", "VIDEO_ASSET", `Could not download clip ${clip.id}. Generating synthetic placeholder...`);
          localVideoPaths.push("placeholder");
        }
      }

      logTask(taskId, "SUCCESS", "VIDEO_ASSET", `Collected ${clips.length} video materials`);
      updateTaskState(30, null, null);

      // Download narration and BGM
      let localNarrationPath: string | null = null;
      if (p.narration_audio_path) {
        // Resolve local relative URLs (e.g. /storage/renders/narration_xxx.mp3)
        if (p.narration_audio_path.startsWith("/") || !p.narration_audio_path.includes("://")) {
          const cleanLocalPath = p.narration_audio_path.startsWith("/") ? p.narration_audio_path.slice(1) : p.narration_audio_path;
          const diskPath = path.join(process.cwd(), cleanLocalPath);
          if (fs.existsSync(diskPath)) {
            localNarrationPath = diskPath;
          }
        }

        if (!localNarrationPath) {
          const ext = path.extname(p.narration_audio_path.split("?")[0]) || ".mp3";
          const dest = path.join(cacheDir, `narration_${projectId}${ext}`);
          try {
            await downloadFile(p.narration_audio_path, dest);
            localNarrationPath = dest;
          } catch (err) {
            console.error(`[Renderer] Narration download failed:`, err);
          }
        }
      }

      let localMusicPath: string | null = null;
      if (musicItem && musicItem.url) {
        // Resolve local relative BGM URLs
        if (musicItem.url.startsWith("/") || !musicItem.url.includes("://")) {
          const cleanLocalPath = musicItem.url.startsWith("/") ? musicItem.url.slice(1) : musicItem.url;
          const diskPath = path.join(process.cwd(), cleanLocalPath);
          if (fs.existsSync(diskPath)) {
            localMusicPath = diskPath;
          }
        }

        if (!localMusicPath) {
          const ext = path.extname(musicItem.url.split("?")[0]) || ".mp3";
          const dest = path.join(cacheDir, `music_${musicItem.id}${ext}`);
          try {
            await downloadFile(musicItem.url, dest);
            localMusicPath = dest;
          } catch (err) {
            console.error(`[Renderer] BGM download failed:`, err);
          }
        }
      }

      logTask(taskId, "INFO", "RENDER", "Rendering final video");
      updateTaskState(40, null, null);

      // Get exact duration of a video file via ffprobe
      const getVideoDuration = async (videoPath: string): Promise<number> => {
        try {
          const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, PROBE_COMMAND_TIMEOUT_MS);
          const d = parseFloat(durationStr.trim());
          return isNaN(d) ? 0 : d;
        } catch (err) {
          console.error(`[getVideoDuration] Failed to probe ${videoPath}:`, err);
          return 0;
        }
      };

      // Detect optimal video encoder (NVENC vs. libx264)
      let encoderArgs = "-c:v libx264 -crf 18 -preset veryfast";
      try {
        logTask(taskId, "INFO", "SYSTEM", "Detecting optimal video encoder (NVIDIA NVENC vs. CPU libx264)...");
        // Run a very quick dummy probe to check if h264_nvenc works on the system
        await executeCommand('ffmpeg -y -f lavfi -i color=c=black:s=16x16:d=0.1 -c:v h264_nvenc -f null -', PROBE_COMMAND_TIMEOUT_MS);
        encoderArgs = "-c:v h264_nvenc -preset p4 -cq 19 -rc vbr";
        logTask(taskId, "INFO", "SYSTEM", "🚀 NVIDIA RTX GPU detected! Enabled hardware-accelerated NVENC encoding for maximum performance.");
      } catch (err) {
        logTask(taskId, "INFO", "SYSTEM", "No hardware NVENC support detected. Using CPU-based libx264 encoder (server/fallback mode).");
      }

      // Format clips
      const formattedClips: string[] = [];
      const isLandscape = p.global_visual_style === "landscape" || p.aspect_ratio === "landscape";
      const resWidth = isLandscape ? 1280 : 720;
      const resHeight = isLandscape ? 720 : 1280;

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const inputPath = localVideoPaths[i];
        const formattedPath = path.join(cacheDir, `formatted_${taskId}_${i}.mp4`);
        const duration = Number(clip.duration_sec) || 5;
        const start = Number(clip.trim_start_sec) || 0;

        if (inputPath === "placeholder") {
          console.log(`[Renderer] Building synthetic placeholder clip ${i}`);
          const cmd = `ffmpeg -y -f lavfi -i color=c=0x1E1E2E:s=${resWidth}x${resHeight}:d=${duration} -r 25 -pix_fmt yuv420p "${formattedPath}"`;
          await executeCommand(cmd);
        } else {
          try {
            const inputDuration = await getVideoDuration(inputPath);
            console.log(`[Renderer] Formatting clip ${i}: ${inputPath}, inputDuration: ${inputDuration}, targetDuration: ${duration}`);

            let loopCmd = "";
            const neededDuration = start + duration;
            if (inputDuration > 0 && inputDuration < neededDuration) {
              const loopCount = Math.ceil(neededDuration / inputDuration);
              loopCmd = `-stream_loop ${loopCount - 1}`;
            }

            // Note: Put -ss and -t after -i for reliable seek/trim when looping is applied
            const cmd = `ffmpeg -y ${loopCmd ? loopCmd + " " : ""}-i "${inputPath}" -ss ${start} -t ${duration} -vf "scale=${resWidth}:${resHeight}:force_original_aspect_ratio=increase,crop=${resWidth}:${resHeight},setsar=1" -r 25 ${encoderArgs} -pix_fmt yuv420p "${formattedPath}"`;
            await executeCommand(cmd);
          } catch (err) {
            console.error(`[Renderer] Failed to format clip ${i} (${inputPath}), falling back to placeholder:`, err);
            logTask(taskId, "WARNING", "VIDEO_ASSET", `Failed to process local video file: ${path.basename(inputPath)}. Using a colored placeholder instead.`);
            const cmd = `ffmpeg -y -f lavfi -i color=c=0x1E1E2E:s=${resWidth}x${resHeight}:d=${duration} -r 25 -pix_fmt yuv420p "${formattedPath}"`;
            await executeCommand(cmd);
          }
        }

        formattedClips.push(formattedPath);
        updateTaskState(Math.floor(40 + (i / clips.length) * 20), null, null);
      }

      logTask(taskId, "INFO", "COMPOSITION", "Combining video 1/1");
      updateTaskState(65, null, null);

      // Concatenate
      const concatFilePath = path.join(cacheDir, `concat_${taskId}.txt`);
      const concatContent = formattedClips.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      await fs.promises.writeFile(concatFilePath, concatContent, "utf8");

      const concatOutput = path.join(cacheDir, `concatenated_${taskId}.mp4`);
      const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -c copy "${concatOutput}"`;
      await executeCommand(concatCmd);
      updateTaskState(75, null, null);

      logTask(taskId, "INFO", "AUDIO_MIXER", "Applying audio and subtitles 1/1");
      updateTaskState(80, null, null);

      // Retrieve exact duration of narration audio to trim final render if needed
      let narrationDuration = 0;
      if (localNarrationPath && fs.existsSync(localNarrationPath)) {
        try {
          const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localNarrationPath}"`, PROBE_COMMAND_TIMEOUT_MS);
          const d = parseFloat(durationStr.trim());
          if (!isNaN(d) && d > 0) {
            narrationDuration = d;
          }
        } catch (e) {
          console.error("[Renderer] Failed to get narration duration:", e);
        }
      }

      // Mix Audio
      const audioMixedOutput = path.join(cacheDir, `audio_mixed_${taskId}.mp4`);
      const audioInputs: string[] = [];

      const voiceVolume = p.params?.voice_volume !== undefined ? p.params.voice_volume : (p.voice_volume !== undefined ? p.voice_volume : 1.0);
      const musicVolume = musicItem?.volume !== undefined ? musicItem.volume : (p.params?.bgm_volume !== undefined ? p.params.bgm_volume : (p.bgm_volume !== undefined ? p.bgm_volume : 0.2));

      if (localNarrationPath) {
        audioInputs.push(`-i "${localNarrationPath}"`);
      }
      if (localMusicPath) {
        audioInputs.push(`-stream_loop -1 -i "${localMusicPath}"`);
      }
      const audioFilter = buildAudioMixFilter(Boolean(localNarrationPath), Boolean(localMusicPath), voiceVolume, musicVolume);

      const limitDurationOpt = buildMixDurationArgs(Boolean(localNarrationPath), narrationDuration);
      const buildMixCmd = (filter: string): string =>
        `ffmpeg -y -i "${concatOutput}" ${audioInputs.join(" ")} -filter_complex "${filter}" -map 0:v -map "[a]" -c:v copy -c:a aac ${limitDurationOpt} "${audioMixedOutput}"`;

      let mixCmd = "";
      if (audioFilter) {
        mixCmd = buildMixCmd(audioFilter);
      } else {
        mixCmd = `ffmpeg -y -i "${concatOutput}" -f lavfi -i anullsrc=r=44100:cl=stereo -c:v copy -c:a aac -shortest ${limitDurationOpt} "${audioMixedOutput}"`;
      }

      try {
        await executeCommand(mixCmd);
      } catch (err: any) {
        const isDucked = audioFilter.includes("sidechaincompress");
        if (!isDucked) throw err;
        // Some FFmpeg builds ship without sidechaincompress. Fall back to the
        // flat mix rather than losing the whole render.
        logTask(taskId, "WARNING", "RENDER", "BGM ducking unavailable, falling back to a flat audio mix.");
        const flatFilter = buildAudioMixFilter(
          Boolean(localNarrationPath),
          Boolean(localMusicPath),
          voiceVolume,
          musicVolume,
          0
        );
        await executeCommand(buildMixCmd(flatFilter));
      }
      updateTaskState(90, null, null);

      // Burn Subtitles
      let subtitles = subtitleTrack?.items || [];
      if (subtitles.length === 0 && p.shot_plan?.segments) {
        console.log(`[Renderer] Subtitle track was empty, falling back to shot_plan segments (${p.shot_plan.segments.length} items)`);
        const fallbackSubtitles: any[] = [];
        p.shot_plan.segments.forEach((seg: any, idx: number) => {
          const startSec = seg.start_sec !== undefined ? seg.start_sec : idx * 5;
          const durationSec = seg.target_duration_sec !== undefined ? seg.target_duration_sec : 5;
          const splitItems = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_fallback_${idx + 1}`);
          fallbackSubtitles.push(...splitItems);
        });
        subtitles = fallbackSubtitles;
      }
      let finalOutputPath = audioMixedOutput;
      const pParams = p.params || {};
      const subtitleEnabledParam = pParams.subtitle_enabled !== undefined ? pParams.subtitle_enabled : (p.subtitle_enabled !== undefined ? p.subtitle_enabled : true);

      if (subtitles.length > 0 && subtitleEnabledParam) {
        // Write custom fonts.conf for fontconfig / libass
        const fontsConfPath = path.join(cacheDir, `fonts_${taskId}.conf`);
        await fs.promises.writeFile(fontsConfPath, buildFontsConf(process.cwd(), taskId), "utf8");

        // Set FONTCONFIG_FILE and FONTCONFIG_PATH in environment variables for ffmpeg
        process.env.FONTCONFIG_FILE = fontsConfPath;
        process.env.FONTCONFIG_PATH = cacheDir;

        const fontNameParam = pParams.font_name || p.font_name || "STHeitiMedium.ttc";
        const fontSizeParam = pParams.font_size || p.font_size || 60;
        const textColorParam = pParams.text_fore_color || p.text_fore_color || "#FFFFFF";
        const strokeColorParam = pParams.stroke_color || p.stroke_color || "#000000";
        const strokeWidthParam = pParams.stroke_width !== undefined ? pParams.stroke_width : (p.stroke_width !== undefined ? p.stroke_width : 1.5);
        const hasBgParam = pParams.text_background_color !== undefined ? pParams.text_background_color : (p.text_background_color !== undefined ? p.text_background_color : true);
        const subtitlePosParam = pParams.subtitle_position || p.subtitle_position || "bottom";
        const customPosParam = pParams.custom_position !== undefined ? pParams.custom_position : (p.custom_position !== undefined ? p.custom_position : 70);
        const subtitleBgStyleParam = pParams.subtitle_bg_style || p.subtitle_bg_style || "solid";
        const roundedBgParam = pParams.rounded_subtitle_background !== undefined ? pParams.rounded_subtitle_background : (p.rounded_subtitle_background !== undefined ? p.rounded_subtitle_background : false);
        const subtitleAnimationParam = pParams.subtitle_animation || p.subtitle_animation || "pop";

        // Generate ASS file with exact styles
        const assFilePath = path.join(cacheDir, `subtitles_${taskId}.ass`);
        const assContent = generateAss(subtitles, resWidth, resHeight, {
          fontName: fontNameParam,
          fontSize: fontSizeParam,
          textColor: textColorParam,
          strokeColor: strokeColorParam,
          strokeWidth: strokeWidthParam,
          hasBg: hasBgParam,
          position: subtitlePosParam,
          customPosition: customPosParam,
          subtitleBgStyle: subtitleBgStyleParam,
          roundedBackground: roundedBgParam,
          subtitleAnimation: subtitleAnimationParam,
        });
        await fs.promises.writeFile(assFilePath, assContent, "utf8");

        const srtOutput = path.join(renderDir, `render_${projectId}.mp4`);
        const assRelative = path.relative(process.cwd(), assFilePath).replace(/\\/g, "/");
        const escapedAssPath = escapeAssPathForFilter(assRelative);

        const subFilter = `subtitles='${escapedAssPath}'`;
        const srtCmd = `ffmpeg -y -i "${audioMixedOutput}" -vf "${subFilter}" ${encoderArgs} -c:a copy "${srtOutput}"`;
        await executeCommand(srtCmd);
        finalOutputPath = srtOutput;
      } else {
        const copyOutput = path.join(renderDir, `render_${projectId}.mp4`);
        await fs.promises.copyFile(audioMixedOutput, copyOutput);
        finalOutputPath = copyOutput;
      }

      // Clean temp files
      for (const f of formattedClips) {
        fs.promises.unlink(f).catch(() => {});
      }
      fs.promises.unlink(concatFilePath).catch(() => {});
      fs.promises.unlink(concatOutput).catch(() => {});
      if (finalOutputPath !== audioMixedOutput) {
        fs.promises.unlink(audioMixedOutput).catch(() => {});
      }

      const finalUrl = `/storage/renders/${p.project_folder_name}/render_${projectId}.mp4`;
      logTask(taskId, "SUCCESS", "RENDER", `Compression and rendering complete. Output file generated at: ${finalUrl}`);
      logTask(taskId, "SUCCESS", "SYSTEM", `Task ${taskId} completed successfully!`);

      p.videos = [finalUrl];
      p.combined_videos = [finalUrl];
      p.updated_at = new Date().toISOString();
      projects.set(projectId, p);

      updateTaskState(100, finalUrl, null, 1);
    } catch (err: any) {
      console.error(`[Renderer] Render failure for project ${projectId}:`, err);
      logTask(taskId, "ERROR", "RENDER", `Rendering failed: ${err.message}`);
      updateTaskState(100, null, err.message, -1);
    }
  };

  return { runRealRender };
}
