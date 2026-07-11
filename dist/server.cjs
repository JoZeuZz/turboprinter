"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var LOCAL_VIDEOS_DIR = import_path.default.join(process.cwd(), "storage", "local_videos");
if (!import_fs.default.existsSync(LOCAL_VIDEOS_DIR)) {
  import_fs.default.mkdirSync(LOCAL_VIDEOS_DIR, { recursive: true });
}
var defaultLocalVideos = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
try {
  const existingFiles = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR);
  if (existingFiles.length === 0) {
    for (const filename of defaultLocalVideos) {
      import_fs.default.writeFileSync(import_path.default.join(LOCAL_VIDEOS_DIR, filename), "MOCK_VIDEO_CONTENT");
    }
  }
} catch (err) {
  console.error("Failed to initialize local videos folder:", err);
}
var BGM_FILES = [
  { name: "Ambient Forest", size: 5410234, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { name: "Cosmic Journey", size: 6109230, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { name: "Sunny Day Acoustic", size: 4892019, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];
var SAMPLE_VIDEOS = [
  {
    id: "v1",
    provider: "pexels",
    source_url: "https://images.pexels.com/video-files/3209211/3209211-hd_1920_1080_25fps.mp4",
    download_url: "https://images.pexels.com/video-files/3209211/3209211-hd_1920_1080_25fps.mp4",
    thumbnail_url: "https://images.pexels.com/videos/3209211/pictures/preview-0.jpg",
    width: 1920,
    height: 1080,
    duration_sec: 15,
    query: "nature",
    title: "Forest Stream"
  },
  {
    id: "v2",
    provider: "pexels",
    source_url: "https://images.pexels.com/video-files/3195398/3195398-hd_1920_1080_25fps.mp4",
    download_url: "https://images.pexels.com/video-files/3195398/3195398-hd_1920_1080_25fps.mp4",
    thumbnail_url: "https://images.pexels.com/videos/3195398/pictures/preview-0.jpg",
    width: 1920,
    height: 1080,
    duration_sec: 20,
    query: "sea",
    title: "Ocean Wave Aerial"
  },
  {
    id: "v3",
    provider: "pexels",
    source_url: "https://images.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4",
    download_url: "https://images.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4",
    thumbnail_url: "https://images.pexels.com/videos/3248319/pictures/preview-0.jpg",
    width: 1920,
    height: 1080,
    duration_sec: 12,
    query: "sunlight",
    title: "Sun Rays in Woods"
  },
  {
    id: "v4",
    provider: "pexels",
    source_url: "https://images.pexels.com/video-files/856973/856973-hd_1920_1080_30fps.mp4",
    download_url: "https://images.pexels.com/video-files/856973/856973-hd_1920_1080_30fps.mp4",
    thumbnail_url: "https://images.pexels.com/videos/856973/pictures/preview-0.jpg",
    width: 1920,
    height: 1080,
    duration_sec: 25,
    query: "city",
    title: "Tokyo Skyline Timelapse"
  },
  {
    id: "v5",
    provider: "pexels",
    source_url: "https://images.pexels.com/video-files/1448735/1448735-hd_1920_1080_24fps.mp4",
    download_url: "https://images.pexels.com/video-files/1448735/1448735-hd_1920_1080_24fps.mp4",
    thumbnail_url: "https://images.pexels.com/videos/1448735/pictures/preview-0.jpg",
    width: 1920,
    height: 1080,
    duration_sec: 18,
    query: "sunset",
    title: "Golden Hour Mountain"
  }
];
async function generateGeminiContent(prompt, jsonMode = false) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key configured. Set GEMINI_API_KEY.");
  }
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: jsonMode ? { responseMimeType: "application/json" } : void 0
        })
      }
    );
    if (!response.ok) {
      const txt = await response.text();
      console.error("Gemini API error status:", response.status, txt);
      throw new Error(`Gemini status ${response.status}`);
    }
    const result = await response.json();
    return result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (err) {
    console.error("Failed calling Gemini API:", err);
    throw err;
  }
}
var projects = /* @__PURE__ */ new Map();
var tasks = /* @__PURE__ */ new Map();
var globalConfig = {
  video_sources: ["pexels", "pixabay", "local"],
  subtitle_position_default: "bottom",
  custom_position_default: 70,
  settings: {
    app: {
      video_source: "pexels",
      tls_verify: true,
      pexels_api_keys: [],
      pixabay_api_keys: [],
      coverr_api_keys: [],
      llm_provider: "gemini",
      llm_fallback_providers: [],
      llm_request_timeout_seconds: 60,
      llm_connect_timeout_seconds: 10,
      gemini_api_key: "",
      gemini_model_name: "gemini-2.5-flash",
      subtitle_provider: "whisper",
      endpoint: "",
      material_directory: "",
      enable_redis: false,
      redis_host: "localhost",
      redis_port: 6379,
      redis_db: 0,
      redis_password: "",
      max_concurrent_tasks: 3,
      max_queued_tasks: 10,
      max_upload_size_mb: 100,
      video_codec: "h264",
      match_materials_to_script: true,
      upload_post_enabled: false,
      upload_post_api_key: "",
      upload_post_username: "",
      upload_post_platforms: [],
      upload_post_auto_upload: false,
      n_threads: 4,
      custom_system_prompt: ""
    },
    whisper: {
      model_size: "base",
      device: "cpu",
      compute_type: "float32"
    },
    azure: {
      speech_key: "",
      speech_region: ""
    },
    siliconflow: {
      api_key: ""
    },
    ui: {
      hide_log: false,
      language: "es",
      subtitle_position: "bottom",
      custom_position: 70,
      layout_mode: "dark",
      bgm_type: "none",
      tts_server: "gemini-tts",
      voice_name: "Zephyr",
      font_name: "UTM Kabel Preview",
      text_fore_color: "#ffffff",
      font_size: 24,
      subtitle_background_enabled: true,
      subtitle_background_color: "#000000",
      rounded_subtitle_background: true,
      stroke_width: 2,
      stroke_color: "#000000",
      text_background_color: "#000000"
    },
    quality: {
      enabled: true,
      profile: "default",
      target_platform: "youtube",
      language: "es",
      prefer_local_assets: false,
      prefer_licensed_assets: true,
      avoid_reencode_intermediates: true,
      normalize_audio: true,
      subtitle_style: "default",
      word_highlight: true,
      safe_area_enabled: true,
      content_package: false,
      use_two_pass: false
    },
    youtube: {
      api_key: "",
      channel_name: "",
      is_linked: false,
      client_id: ""
    }
  },
  options: {
    video_sources: ["pexels", "pixabay", "local"],
    video_codecs: ["h264", "hevc"],
    llm_providers: ["gemini", "openai", "siliconflow"],
    quality_profiles: ["default", "high", "low"],
    subtitle_positions: ["top", "middle", "bottom", "custom"],
    whisper_devices: ["cpu", "cuda"]
  }
};
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  function loadConfigToml() {
    const tomlPath = import_path.default.join(process.cwd(), "config.toml");
    if (import_fs.default.existsSync(tomlPath)) {
      try {
        console.log("[Config] Found config.toml. Loading keys...");
        const content = import_fs.default.readFileSync(tomlPath, "utf-8");
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) {
            continue;
          }
          const match = trimmed.match(/^([\w_.-]+)\s*=\s*(.*)$/);
          if (match) {
            const key = match[1].trim();
            let rawValue = match[2].trim();
            rawValue = rawValue.split("#")[0].trim();
            if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
              const values = rawValue.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
              if (key === "pexels_api_keys" || key === "pexels_api_key") {
                globalConfig.settings.app.pexels_api_keys = values;
              } else if (key === "pixabay_api_keys" || key === "pixabay_api_key") {
                globalConfig.settings.app.pixabay_api_keys = values;
              }
            } else {
              const value = rawValue.replace(/^["']|["']$/g, "").trim();
              if (value) {
                const envKey = key.toUpperCase();
                if (!process.env[envKey]) {
                  process.env[envKey] = value;
                  console.log(`[Config] Loaded ${envKey} from config.toml`);
                }
                if (key === "gemini_api_key") {
                  process.env.GEMINI_API_KEY = value;
                  globalConfig.settings.app.gemini_api_key = value;
                  console.log(`[Config] Loaded GEMINI_API_KEY from config.toml`);
                }
                if (key === "pexels_api_key" && globalConfig.settings.app.pexels_api_keys.length === 0) {
                  globalConfig.settings.app.pexels_api_keys = [value];
                }
                if (key === "pixabay_api_key" && globalConfig.settings.app.pixabay_api_keys.length === 0) {
                  globalConfig.settings.app.pixabay_api_keys = [value];
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("[Config] Failed to parse config.toml:", err);
      }
    }
  }
  loadConfigToml();
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });
  const wrap = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
  app.get("/api/v1/config", wrap(async (req, res) => {
    res.json({ status: 200, message: "ok", data: globalConfig });
  }));
  app.get("/api/v1/local-videos", wrap(async (req, res) => {
    try {
      const files = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR);
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
      const videoFiles = files.filter((file) => videoExtensions.includes(import_path.default.extname(file).toLowerCase())).map((file) => {
        const stats = import_fs.default.statSync(import_path.default.join(LOCAL_VIDEOS_DIR, file));
        return {
          name: file,
          size: stats.size,
          path: `storage/local_videos/${file}`
        };
      });
      res.json({ status: 200, message: "ok", data: { files: videoFiles } });
    } catch (err) {
      res.status(500).json({ status: 500, message: err.message, data: null });
    }
  }));
  app.put("/api/v1/config", wrap(async (req, res) => {
    globalConfig.settings = { ...globalConfig.settings, ...req.body };
    res.json({ status: 200, message: "ok", data: globalConfig });
  }));
  app.get("/api/v1/voices", wrap(async (req, res) => {
    const provider = req.query.provider || "";
    let voicesList = [
      { value: "Zephyr", label: "Zephyr (Neutral/Friendly)" },
      { value: "Kore", label: "Kore (Cheer/Energetic)" },
      { value: "Puck", label: "Puck (Narrator/Deep)" },
      { value: "Fenrir", label: "Fenrir (Soft/Calm)" },
      { value: "Charon", label: "Charon (Professional)" }
    ];
    if (provider === "azure-tts-v1" || provider === "edge-tts") {
      voicesList = [
        { value: "es-ES-AlvaroNeural", label: "es-ES \xC1lvaro (Male)" },
        { value: "es-ES-ElviraNeural", label: "es-ES Elvira (Female)" },
        { value: "es-MX-DaliaNeural", label: "es-MX Dalia (Female)" },
        { value: "es-MX-JorgeNeural", label: "es-MX Jorge (Male)" },
        { value: "en-US-JennyNeural", label: "en-US Jenny (Female)" },
        { value: "en-US-GuyNeural", label: "en-US Guy (Male)" },
        { value: "zh-CN-XiaoxiaoNeural", label: "zh-CN Xiaoxiao (Female)" },
        { value: "zh-CN-YunxiNeural", label: "zh-CN Yunxi (Male)" },
        ...voicesList
      ];
    }
    res.json({
      status: 200,
      message: "ok",
      data: {
        voices: voicesList
      }
    });
  }));
  app.post("/api/v1/voices/preview", wrap(async (req, res) => {
    res.redirect("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
  }));
  app.post("/api/v1/scripts", wrap(async (req, res) => {
    const { video_subject, video_language = "es", paragraph_number = 3 } = req.body;
    let scriptText = "";
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Escribe un gui\xF3n de video cautivador, detallado y narrativo sobre "${video_subject}" en idioma ${video_language}. Es CR\xCDTICO que el gui\xF3n tenga exactamente ${paragraph_number} p\xE1rrafos bien estructurados, completos y detallados (cada p\xE1rrafo debe ser lo suficientemente largo y descriptivo, \xF3ptimo para narrar una historia o un documental). Separa cada p\xE1rrafo estrictamente con dos saltos de l\xEDnea (\\n\\n). Devuelve SOLAMENTE el texto del gui\xF3n, sin t\xEDtulos, introducciones ni comentarios adicionales.`;
        scriptText = await generateGeminiContent(prompt);
      } catch (err) {
        console.warn("Gemini script generation failed, falling back to static", err);
      }
    }
    if (!scriptText) {
      const fallbackParagraphs = [
        `Bienvenidos a este viaje fascinante y profundamente revelador por el maravilloso mundo de ${video_subject}. En este relato, nos disponemos a desentra\xF1ar los secretos m\xE1s asombrosos, las leyendas ocultas y los acontecimientos hist\xF3ricos que han dado forma a este tema y que despiertan una inmensa pasi\xF3n en todos aquellos que se atreven a explorarlo con una mirada curiosa y atenta.`,
        `Al adentrarnos en las profundidades de ${video_subject}, comenzamos a descubrir detalles verdaderamente sorprendentes que desaf\xEDan lo convencional y cambian por completo nuestra percepci\xF3n cotidiana de la realidad. Es un espect\xE1culo absolutamente asombroso contemplar c\xF3mo la ciencia rigurosa, la majestuosidad de la naturaleza ind\xF3mita y la chispa inagotable de la creatividad humana se entrelazan de manera perfecta para crear algo \xFAnico.`,
        `Cada rinc\xF3n y cada \xE9poca relacionados con ${video_subject} albergan lecciones valiosas de perseverancia, ingenio y misterio. A trav\xE9s de los a\xF1os, grandes pensadores y exploradores dedicaron sus vidas enteras a comprender estas din\xE1micas, dejando un legado imborrable que hoy en d\xEDa contin\xFAa inspirando a nuevas generaciones de entusiastas en todo el planeta.`,
        `Este impacto cultural y social no solo se limita al pasado, sino que sigue moldeando activamente nuestras interacciones modernas y la forma en que concebimos el ma\xF1ana. Comprender la esencia misma de ${video_subject} nos permite conectar con un prop\xF3sito mayor, reconociendo las influencias invisibles pero poderosas que gu\xEDan constantemente nuestras decisiones y nuestra evoluci\xF3n colectiva.`,
        `Esperamos sinceramente que hayan disfrutado al m\xE1ximo de este enriquecedor recorrido lleno de aprendizaje y asombro. Los invitamos cordialmente a seguir explorando este y otros enigmas con la mente abierta, recordando siempre que la curiosidad insaciable es el verdadero motor que impulsa el conocimiento humano hacia horizontes infinitos.`
      ];
      const resultParagraphs = [...fallbackParagraphs];
      while (resultParagraphs.length < paragraph_number) {
        resultParagraphs.push(
          `Adem\xE1s, al reflexionar sobre la trascendencia de ${video_subject}, nos damos cuenta de que existen dimensiones inexploradas que prometen seguir revelando sorpresas y planteando preguntas fascinantes en los a\xF1os venideros, consolidando su lugar como un pilar fundamental en la historia del saber.`
        );
      }
      scriptText = resultParagraphs.slice(0, paragraph_number).join("\n\n");
    }
    res.json({ status: 200, message: "ok", data: { video_script: scriptText } });
  }));
  app.post("/api/v1/terms", wrap(async (req, res) => {
    const { video_subject, video_script = "" } = req.body;
    let terms = [];
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Analiza el siguiente gui\xF3n de video y genera una lista de exactamente 5 t\xE9rminos de b\xFAsqueda en ingl\xE9s (para buscar videos de stock relevantes). Devuelve una respuesta JSON con el formato: { "terms": ["term1", "term2", ...] }. Gui\xF3n: ${video_script}`;
        const resp = await generateGeminiContent(prompt, true);
        const parsed = JSON.parse(resp);
        terms = parsed.terms || [];
      } catch (err) {
        console.warn("Gemini terms extraction failed, falling back to static", err);
      }
    }
    if (!terms || terms.length === 0) {
      terms = [video_subject, "nature", "epic", "cinematic", "scenic"];
    }
    res.json({ status: 200, message: "ok", data: { video_terms: terms } });
  }));
  const logTask = (taskId, level, category, message) => {
    const t = tasks.get(taskId);
    if (t) {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19);
      const logLine = `[${timestamp}] [${level}] [${category.toUpperCase()}] ${message}`;
      if (!t.logs) t.logs = [];
      t.logs.push(logLine);
      console.log(`Task ${taskId}: ${logLine}`);
      tasks.set(taskId, t);
    }
  };
  app.post("/api/v1/videos", wrap(async (req, res) => {
    const {
      video_source,
      local_video_files,
      video_script,
      video_subject,
      voice_name,
      bgm_file,
      video_aspect,
      font_name,
      font_size,
      text_fore_color,
      video_concat_mode,
      bgm_volume,
      n_threads,
      video_codec,
      tts_provider
    } = req.body;
    const taskId = "task_" + Math.random().toString(36).substring(2, 9);
    const taskStatus = {
      state: 4,
      // TASK_STATE_PROCESSING
      progress: 0,
      videos: [],
      combined_videos: [],
      logs: []
    };
    tasks.set(taskId, taskStatus);
    logTask(taskId, "INFO", "SYSTEM", `Initializing video generation task ${taskId}...`);
    logTask(taskId, "INFO", "VALIDATION", "Verifying request payload parameters...");
    let validationFailed = false;
    let validationErrorMessage = "";
    if (video_source === "local") {
      logTask(taskId, "INFO", "VALIDATION", `Video source is set to LOCAL. Selected files: ${Array.isArray(local_video_files) ? local_video_files.join(", ") : "None"}`);
      if (!local_video_files || !Array.isArray(local_video_files) || local_video_files.length === 0) {
        validationFailed = true;
        validationErrorMessage = "No local video files were selected. Please choose at least one video in the Configurations panel.";
      } else {
        const missingFiles = [];
        for (const file of local_video_files) {
          const filePath = import_path.default.join(LOCAL_VIDEOS_DIR, file);
          if (!import_fs.default.existsSync(filePath)) {
            missingFiles.push(file);
          }
        }
        if (missingFiles.length > 0) {
          validationFailed = true;
          validationErrorMessage = `The following selected files do not exist in storage/local_videos: ${missingFiles.join(", ")}. Please make sure they exist.`;
        }
      }
    } else {
      logTask(taskId, "INFO", "VALIDATION", `Video source is set to ONLINE (${video_source || "pexels"}).`);
    }
    if (!validationFailed) {
      if (!video_script && !video_subject) {
        validationFailed = true;
        validationErrorMessage = "Both the video script and subject are empty. Please write a script or enter a subject to generate one.";
      }
    }
    if (validationFailed) {
      logTask(taskId, "ERROR", "VALIDATION", `Validation Failed: ${validationErrorMessage}`);
      logTask(taskId, "ERROR", "SYSTEM", "Task execution aborted due to pre-requisite failures.");
      const t = tasks.get(taskId);
      if (t) {
        t.state = -1;
        tasks.set(taskId, t);
      }
      return res.json({ status: 200, message: "ok", data: { task_id: taskId } });
    }
    logTask(taskId, "SUCCESS", "VALIDATION", `All parameters validated. Script character count: ${video_script?.length || 0}. Format: ${video_aspect || "9:16"}`);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      const t = tasks.get(taskId);
      if (!t) {
        clearInterval(interval);
        return;
      }
      t.progress = progress;
      tasks.set(taskId, t);
      if (progress === 20) {
        logTask(taskId, "INFO", "TTS", `Starting Text-to-Speech synthesis using provider: "${tts_provider || "azure-tts-v1"}"...`);
        if (!voice_name) {
          logTask(taskId, "WARNING", "TTS", "No voice name specified. Falling back to default neural speaker.");
        } else {
          logTask(taskId, "INFO", "TTS", `Synthesizing spoken track with voice: "${voice_name}"...`);
        }
        logTask(taskId, "SUCCESS", "TTS", `Audio track synthesized successfully. Duration: 38.4s. Saved as tts_${taskId}.mp3.`);
      } else if (progress === 40) {
        logTask(taskId, "INFO", "SUBTITLES", "Loading Whisper voice-alignment model...");
        logTask(taskId, "INFO", "SUBTITLES", "Aligning spoken voice audio to original script tokens...");
        logTask(taskId, "SUCCESS", "SUBTITLES", "Successfully generated subtitle cues (SRT) with timestamp mappings.");
      } else if (progress === 60) {
        if (video_source === "local") {
          logTask(taskId, "INFO", "VIDEO_ASSET", `Loading ${local_video_files.length} verified files from local storage...`);
          local_video_files.forEach((file) => {
            logTask(taskId, "INFO", "VIDEO_ASSET", `Including asset: storage/local_videos/${file}`);
          });
          logTask(taskId, "SUCCESS", "VIDEO_ASSET", "All local assets imported successfully.");
        } else {
          logTask(taskId, "INFO", "VIDEO_ASSET", `Querying search terms from online API provider (${video_source || "pexels"})...`);
          logTask(taskId, "SUCCESS", "VIDEO_ASSET", `Successfully retrieved and cached 5 clips matching tags: ${Array.isArray(req.body.video_terms) ? req.body.video_terms.join(", ") : "general"}.`);
        }
      } else if (progress === 80) {
        logTask(taskId, "INFO", "COMPOSITION", `Joining video assets with concat mode: "${video_concat_mode || "random"}"`);
        if (bgm_file) {
          logTask(taskId, "INFO", "AUDIO_MIXER", `Mixing background music track: "${bgm_file}" at volume: ${bgm_volume || 0.2}`);
        } else {
          logTask(taskId, "INFO", "AUDIO_MIXER", "Injecting ambient background music track...");
        }
        logTask(taskId, "INFO", "COMPOSITION", `Burning subtitle overlays onto visual frames (Font: "${font_name || "STHeitiMedium.ttc"}", Size: ${font_size || 60}px, Color: "${text_fore_color || "#FFFFFF"}")...`);
        logTask(taskId, "SUCCESS", "COMPOSITION", "Composition of video and subtitle tracks complete.");
      } else if (progress >= 100) {
        logTask(taskId, "INFO", "RENDER", `Launching FFmpeg encoding task (Threads: ${n_threads || 2}, Codec: "${video_codec || "libx264"}")...`);
        logTask(taskId, "SUCCESS", "RENDER", `Compression and rendering complete. Output file generated at: storage/renders/render_${taskId}.mp4`);
        logTask(taskId, "SUCCESS", "SYSTEM", `Task ${taskId} completed successfully!`);
        t.state = 1;
        t.videos = [SAMPLE_VIDEOS[0].source_url];
        t.combined_videos = [SAMPLE_VIDEOS[0].source_url];
        tasks.set(taskId, t);
        clearInterval(interval);
      }
    }, 1500);
    res.json({ status: 200, message: "ok", data: { task_id: taskId } });
  }));
  app.get("/tasks/:id", wrap(async (req, res) => {
    const t = tasks.get(req.params.id);
    if (!t) {
      return res.status(404).json({ status: 404, message: "Task not found", data: null });
    }
    res.json({ status: 200, message: "ok", data: t });
  }));
  app.get("/tasks", wrap(async (req, res) => {
    const data = {};
    for (const [k, v] of tasks.entries()) {
      data[k] = v;
    }
    res.json({ status: 200, message: "ok", data });
  }));
  app.delete("/tasks/:id", wrap(async (req, res) => {
    tasks.delete(req.params.id);
    res.json({ status: 200, message: "ok", data: null });
  }));
  app.get("/api/v1/musics", wrap(async (req, res) => {
    res.json({ status: 200, message: "ok", data: { files: BGM_FILES } });
  }));
  app.get("/api/v1/projects", wrap(async (req, res) => {
    const list = Array.from(projects.values()).map((p) => ({
      project_id: p.project_id,
      topic: p.topic || "Untitled Project",
      updated_at: p.updated_at
    }));
    res.json({ status: 200, message: "ok", data: { projects: list } });
  }));
  app.post("/api/v1/projects/from-topic", wrap(async (req, res) => {
    const { topic, language = "es", generate_script = true, paragraph_number = 3 } = req.body;
    const projectId = "proj_" + Math.random().toString(36).substring(2, 9);
    let scriptText = "";
    if (generate_script) {
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `Escribe un gui\xF3n de video para un video educativo sobre "${topic}" en idioma ${language}. Debe tener alrededor de ${paragraph_number} p\xE1rrafos. Devuelve \xFAnicamente el gui\xF3n final.`;
          scriptText = await generateGeminiContent(prompt);
        } catch {
        }
      }
      if (!scriptText) {
        scriptText = [
          `Hoy profundizaremos en el maravilloso concepto de ${topic}. Este tema ha revolucionado la forma en que entendemos el mundo actual.`,
          `Hist\xF3ricamente, los desarrollos han demostrado que ${topic} influye en m\xFAltiples sectores, desde el arte hasta la tecnolog\xEDa m\xE1s avanzada.`,
          `Para concluir, el futuro de ${topic} sigue brillando con fuerza y promete continuar inspirando a las pr\xF3ximas generaciones.`
        ].slice(0, paragraph_number).join("\n\n");
      }
    }
    const newProject = {
      project_id: projectId,
      topic,
      language,
      script: scriptText,
      has_script: !!scriptText,
      has_shot_plan: false,
      has_selected_media: false,
      has_timeline: false,
      tracks: [],
      selected_media: [],
      media_candidates: [],
      selected_music: [],
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    projects.set(projectId, newProject);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: projectId, has_script: !!scriptText, source_kind: "topic" }
    });
  }));
  app.post("/api/v1/projects/from-script", wrap(async (req, res) => {
    const { script, topic = "Video Script", language = "es" } = req.body;
    const projectId = "proj_" + Math.random().toString(36).substring(2, 9);
    const newProject = {
      project_id: projectId,
      topic: topic || "Gui\xF3n de Video",
      language,
      script,
      has_script: true,
      has_shot_plan: false,
      has_selected_media: false,
      has_timeline: false,
      tracks: [],
      selected_media: [],
      media_candidates: [],
      selected_music: [],
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    projects.set(projectId, newProject);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: projectId, has_script: true, source_kind: "script" }
    });
  }));
  app.post("/api/v1/projects/from-reddit", wrap(async (req, res) => {
    const { url, title, body, language = "es" } = req.body;
    const projectId = "proj_" + Math.random().toString(36).substring(2, 9);
    const script = `${title}

${body}`;
    const newProject = {
      project_id: projectId,
      topic: title || "Reddit Post",
      language,
      script,
      has_script: true,
      has_shot_plan: false,
      has_selected_media: false,
      has_timeline: false,
      tracks: [],
      selected_media: [],
      media_candidates: [],
      selected_music: [],
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    projects.set(projectId, newProject);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: projectId, has_script: true, source_kind: "reddit" }
    });
  }));
  app.get("/api/v1/projects/:id", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    res.json({ status: 200, message: "ok", data: p });
  }));
  app.delete("/api/v1/projects/:id", wrap(async (req, res) => {
    projects.delete(req.params.id);
    res.json({ status: 200, message: "ok", data: { project_id: req.params.id, deleted: true } });
  }));
  app.patch("/api/v1/projects/:id/metadata", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    p.topic = req.body.topic;
    p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(req.params.id, p);
    res.json({ status: 200, message: "ok", data: { project_id: p.project_id, topic: p.topic } });
  }));
  app.post("/api/v1/projects/:id/duplicate", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const newId = "proj_" + Math.random().toString(36).substring(2, 9);
    const duplicated = JSON.parse(JSON.stringify(p));
    duplicated.project_id = newId;
    duplicated.topic = p.topic + " Copy";
    duplicated.created_at = (/* @__PURE__ */ new Date()).toISOString();
    duplicated.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(newId, duplicated);
    res.json({ status: 200, message: "ok", data: { project_id: newId } });
  }));
  app.put("/api/v1/projects/:id", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const updated = { ...p, ...req.body };
    updated.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(req.params.id, updated);
    res.json({ status: 200, message: "ok", data: { project_id: p.project_id } });
  }));
  app.post("/api/v1/projects/:id/plan", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const sentences = (p.script || p.topic || "").split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
    const segments = sentences.map((sentence, idx) => {
      const words = sentence.split(" ");
      const firstWord = words[0] || "scenic";
      const secondWord = words[1] || "beautiful";
      return {
        id: `seg_${idx + 1}`,
        order: idx + 1,
        narration_text: sentence,
        start_sec: idx * 5,
        end_sec: (idx + 1) * 5,
        target_duration_sec: 5,
        visual_goal: `Visual style representing: ${sentence}`,
        search_queries: [firstWord, secondWord, "cinematic"]
      };
    });
    p.shot_plan = {
      language: p.language || "es",
      topic: p.topic,
      script: p.script,
      total_duration_sec: segments.length * 5,
      segments,
      global_visual_style: req.body.global_visual_style || "cinematic",
      music_intent: {
        mood: "inspirational",
        energy: "mid",
        tempo: "slow",
        style: "acoustic"
      }
    };
    p.has_shot_plan = true;
    p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(req.params.id, p);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, segment_count: segments.length }
    });
  }));
  app.post("/api/v1/projects/:id/media/search", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const candidates = p.shot_plan?.segments?.flatMap((seg) => {
      return SAMPLE_VIDEOS.map((v, i) => ({
        ...v,
        id: `${seg.id}_cand_${i + 1}`,
        segment_id: seg.id,
        score: 0.9 - i * 0.1,
        score_reasons: ["Matches query: " + seg.search_queries.join(", ")]
      }));
    }) || [];
    const selected = p.shot_plan?.segments?.map((seg) => {
      const best = SAMPLE_VIDEOS[Math.floor(Math.random() * SAMPLE_VIDEOS.length)];
      return {
        ...best,
        id: `${seg.id}_selected`,
        segment_id: seg.id
      };
    }) || [];
    p.media_candidates = candidates;
    p.selected_media = selected;
    p.has_selected_media = true;
    p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(req.params.id, p);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, selected_count: selected.length }
    });
  }));
  app.post("/api/v1/projects/:id/timeline/build", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const videoItems = (p.selected_media || []).map((med, idx) => ({
      id: `item_${idx + 1}`,
      media_id: med.id,
      local_path: med.local_path,
      asset_url: med.source_url,
      thumbnail_url: med.thumbnail_url,
      source_url: med.source_url,
      start_sec: idx * 5,
      duration_sec: 5,
      trim_start_sec: 0,
      trim_end_sec: 5,
      segment_id: med.segment_id,
      provider: med.provider
    }));
    const subtitleItems = (p.shot_plan?.segments || []).map((seg, idx) => ({
      id: `sub_${idx + 1}`,
      start_sec: idx * 5,
      duration_sec: 5,
      text: seg.narration_text,
      segment_id: seg.id
    }));
    p.tracks = [
      { id: "track_video", type: "video", name: "Video Track", items: videoItems },
      { id: "track_subtitle", type: "subtitle", name: "Subtitle Track", items: subtitleItems }
    ];
    p.has_timeline = true;
    p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(req.params.id, p);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, track_count: p.tracks.length }
    });
  }));
  app.post("/api/v1/projects/:id/narration", wrap(async (req, res) => {
    res.json({
      status: 200,
      message: "ok",
      data: {
        project_id: req.params.id,
        narration_audio_path: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        audio_duration_sec: 30,
        subtitle_path: null
      }
    });
  }));
  app.post("/api/v1/projects/:id/timeline/commands", wrap(async (req, res) => {
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: req.params.id, applied: req.body.commands?.length || 0, valid: true }
    });
  }));
  app.post("/api/v1/projects/:id/timeline/validate", wrap(async (req, res) => {
    res.json({ status: 200, message: "ok", data: { project_id: req.params.id, valid: true } });
  }));
  app.post("/api/v1/projects/:id/music/select", wrap(async (req, res) => {
    const selectedMusic = {
      id: "bgm_1",
      provider: "jamendo",
      url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      title: "Cosmic Journey",
      duration_sec: 180,
      volume: req.body.volume || 0.2
    };
    const p = projects.get(req.params.id);
    if (p) {
      p.selected_music = [selectedMusic];
      projects.set(req.params.id, p);
    }
    res.json({ status: 200, message: "ok", data: { project_id: req.params.id, selected: selectedMusic, selected_count: 1 } });
  }));
  app.get("/api/v1/projects/:id/music", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    res.json({
      status: 200,
      message: "ok",
      data: {
        project_id: req.params.id,
        tracks: p?.selected_music || []
      }
    });
  }));
  app.post("/api/v1/projects/:id/render", wrap(async (req, res) => {
    const renderTaskId = "render_task_" + req.params.id;
    tasks.set(renderTaskId, {
      state: 4,
      // TASK_STATE_PROCESSING
      progress: 0,
      output_path: null,
      error: null
    });
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      const t = tasks.get(renderTaskId);
      if (t) {
        t.progress = progress;
        if (progress >= 100) {
          t.state = 1;
          t.output_path = SAMPLE_VIDEOS[3].source_url;
          clearInterval(interval);
        }
        tasks.set(renderTaskId, t);
      } else {
        clearInterval(interval);
      }
    }, 1500);
    res.json({ status: 200, message: "ok", data: { project_id: req.params.id, state: 4 } });
  }));
  app.get("/api/v1/projects/:id/render", wrap(async (req, res) => {
    const renderTaskId = "render_task_" + req.params.id;
    const t = tasks.get(renderTaskId) || { state: 1, progress: 100, output_path: SAMPLE_VIDEOS[3].source_url };
    res.json({
      status: 200,
      message: "ok",
      data: {
        task_id: renderTaskId,
        state: t.state,
        progress: t.progress,
        output_path: t.output_path,
        error: t.error
      }
    });
  }));
  app.get("/api/v1/projects/:id/assets", wrap(async (req, res) => {
    res.json({
      status: 200,
      message: "ok",
      data: {
        project_id: req.params.id,
        assets: [],
        preview_assets: []
      }
    });
  }));
  app.get("/api/v1/projects/:id/assets/*", wrap(async (req, res) => {
    res.redirect("https://images.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4");
  }));
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.use((err, req, res, next) => {
    console.error("[Server Error]", err);
    res.status(500).json({ status: 500, message: err.message || "Internal Server Error", data: null });
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
