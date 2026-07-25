import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";
import WebSocket from "ws";
import crypto from "crypto";
import {
  generateAss,
  generateSrt,
  splitTextIntoTikTokSubtitles,
} from "./src/lib/subtitleLayout";
import {
  loadChannels,
  saveChannels,
  getActiveChannel,
  upsertChannel,
  selectChannel,
  removeChannel,
} from "./src/server/youtubeChannels";
import { updateEnvFile } from "./src/server/envFile";
import { synthesizeSpeech } from "./src/server/tts";
import { generateLlmContent } from "./src/server/llm";
import { searchPexelsVideos, pickUniqueClip } from "./src/server/pexels";
import { createRenderer, executeCommand } from "./src/server/render";
import { createProjectsRepo } from "./src/server/projectsRepo";
import {
  loadTiktokChannels,
  saveTiktokChannels,
  getActiveTiktokChannel,
  upsertTiktokChannel,
  selectTiktokChannel,
  removeTiktokChannel,
  setTiktokVerification,
  clearTiktokCredentials,
  writeTiktokVerificationFiles,
} from "./src/server/tiktokCredentials";
import { google } from "googleapis";
import multer from "multer";

// Load .env variables manually if they exist
try {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const parts = trimmed.split("=");
        const key = parts[0]?.trim();
        const value = parts.slice(1).join("=").trim();
        if (key && value) {
          process.env[key] = value.replace(/^['"]|['"]$/g, ""); // remove wrapping quotes if present
        }
      }
    });
  }
} catch (e) {
  console.error("Error parsing .env file:", e);
}

// Ensure local_videos directory exists and is populated with dummy files if empty
let LOCAL_VIDEOS_DIR = path.join(process.cwd(), "storage", "local_videos");
if (fs.existsSync(path.join(process.cwd(), "local_videos"))) {
  LOCAL_VIDEOS_DIR = path.join(process.cwd(), "local_videos");
} else if (!fs.existsSync(LOCAL_VIDEOS_DIR)) {
  fs.mkdirSync(LOCAL_VIDEOS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOCAL_VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname);
    cb(null, safeName);
  }
});
const upload = multer({ storage });

// Populate sample local videos if empty
const defaultLocalVideos = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
try {
  const existingFiles = fs.readdirSync(LOCAL_VIDEOS_DIR);
  if (existingFiles.length === 0) {
    for (const filename of defaultLocalVideos) {
      fs.writeFileSync(path.join(LOCAL_VIDEOS_DIR, filename), "MOCK_VIDEO_CONTENT");
    }
  }
} catch (err) {
  console.error("Failed to initialize local videos folder:", err);
}

// Mock BGM files
const BGM_FILES = [
  { name: "Ambient Forest", size: 5410234, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", tags: ["nature", "forest", "ambient", "calm", "slow", "relax", "meditation", "peaceful", "wood", "water", "tree", "river"] },
  { name: "Cosmic Journey", size: 6109230, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", tags: ["space", "cosmic", "journey", "synth", "futuristic", "tech", "modern", "energy", "inspirational", "fast", "electronic", "star"] },
  { name: "Sunny Day Acoustic", size: 4892019, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", tags: ["acoustic", "guitar", "happy", "sunny", "day", "cheerful", "organic", "warm", "people", "friend", "life", "fun"] }
];

// Mock Stock Videos
const SAMPLE_VIDEOS = [
  {
    id: "v1",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/3209211/3209211-hd_1920_1080_25fps.mp4",
    download_url: "https://videos.pexels.com/video-files/3209211/3209211-hd_1920_1080_25fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 15,
    query: "nature",
    title: "Forest Stream"
  },
  {
    id: "v2",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/3195398/3195398-hd_1920_1080_25fps.mp4",
    download_url: "https://videos.pexels.com/video-files/3195398/3195398-hd_1920_1080_25fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 20,
    query: "sea",
    title: "Ocean Wave Aerial"
  },
  {
    id: "v3",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4",
    download_url: "https://videos.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 12,
    query: "sunlight",
    title: "Sun Rays in Woods"
  },
  {
    id: "v4",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_30fps.mp4",
    download_url: "https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_30fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 25,
    query: "city",
    title: "Tokyo Skyline Timelapse"
  },
  {
    id: "v5",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_24fps.mp4",
    download_url: "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_24fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 18,
    query: "sunset",
    title: "Golden Hour Mountain"
  },
  {
    id: "v6",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/2048246/2048246-hd_1920_1080_24fps.mp4",
    download_url: "https://videos.pexels.com/video-files/2048246/2048246-hd_1920_1080_24fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 15,
    query: "foggy",
    title: "Mist Over Mountains"
  },
  {
    id: "v7",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/2811417/2811417-hd_1920_1080_24fps.mp4",
    download_url: "https://videos.pexels.com/video-files/2811417/2811417-hd_1920_1080_24fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1472214222541-d510753a4907?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 22,
    query: "valley",
    title: "Green Meadows"
  },
  {
    id: "v8",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/5092640/5092640-hd_1920_1080_30fps.mp4",
    download_url: "https://videos.pexels.com/video-files/5092640/5092640-hd_1920_1080_30fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 14,
    query: "snow",
    title: "Snowy Pine Forests"
  },
  {
    id: "v9",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/3191571/3191571-hd_1920_1080_25fps.mp4",
    download_url: "https://videos.pexels.com/video-files/3191571/3191571-hd_1920_1080_25fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 17,
    query: "beach",
    title: "Sunset Over Beach Waves"
  },
  {
    id: "v10",
    provider: "pexels",
    source_url: "https://videos.pexels.com/video-files/3121435/3121435-hd_1920_1080_24fps.mp4",
    download_url: "https://videos.pexels.com/video-files/3121435/3121435-hd_1920_1080_24fps.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    width: 1920,
    height: 1080,
    duration_sec: 19,
    query: "island",
    title: "Tropical Shoreline"
  }
];

function cleanScriptSymbols(text: string): string {
  if (!text) return "";
  return text
    // Remove asterisks (*) and underscores (_) used for markdown bold/italic
    .replace(/[\*_]/g, "")
    // Remove various types of quotation marks: ", “, ”, «, », ‘, ’, '
    .replace(/["“”«»‘’']/g, "")
    // Remove parentheses, brackets and braces: (, ), [, ], {, }
    .replace(/[()[\]{}]/g, "")
    // Clean up any double spaces that might have been introduced
    .replace(/ {2,}/g, " ")
    .trim();
}

function sanitizeFolderName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 40) || "project";
}

function getFormattedDateTime(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

// Project database: repository with explicit persistence on set/delete.
const projects = createProjectsRepo();

const tasks = new Map<string, any>();

// Default Global Config Configuration
let globalConfig = {
  video_sources: ["pexels", "pixabay", "local"],
  subtitle_position_default: "bottom",
  custom_position_default: 70,
  settings: {
    app: {
      video_source: "pexels",
      tls_verify: true,
      pexels_api_keys: [process.env.PEXELS_API_KEY || "PEXELS_KEY_REMOVED_FROM_HISTORY_ROTATE_IT"],
      pixabay_api_keys: [],
      coverr_api_keys: [],
      llm_provider: "gemini",
      llm_fallback_providers: [],
      llm_request_timeout_seconds: 60,
      llm_connect_timeout_seconds: 10,
      gemini_api_key: "",
      gemini_model_name: "gemini-3.5-flash",
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
    },
    tiktok: {
      client_id: "",
      client_secret: "",
      is_linked: false,
      account_name: "",
      verification_filename: "",
      verification_content: ""
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
  const app = express();
  const PORT = 3000;

  // Load configuration from config.toml if it exists
  function loadConfigToml() {
    const tomlPath = path.join(process.cwd(), "config.toml");
    if (fs.existsSync(tomlPath)) {
      try {
        console.log("[Config] Found config.toml. Loading keys...");
        const content = fs.readFileSync(tomlPath, "utf-8");
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
              const values = rawValue
                .slice(1, -1)
                .split(",")
                .map((s) => s.trim().replace(/^["']|["']$/g, ""))
                .filter(Boolean);
              
              if (key === "pexels_api_keys" || key === "pexels_api_key") {
                globalConfig.settings.app.pexels_api_keys = values as never[];
              } else if (key === "pixabay_api_keys" || key === "pixabay_api_key") {
                globalConfig.settings.app.pixabay_api_keys = values as never[];
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
                  globalConfig.settings.app.pexels_api_keys = [value] as never[];
                }
                if (key === "pixabay_api_key" && globalConfig.settings.app.pixabay_api_keys.length === 0) {
                  globalConfig.settings.app.pixabay_api_keys = [value] as never[];
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

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Add Request logger middleware
  app.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });

  // API Route helpers
  const wrap = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  // 1. Config APIs
  app.get("/api/v1/config", wrap(async (req: any, res: any) => {
    {
      const creds = loadChannels();
      const activeChannel = getActiveChannel(creds);
      globalConfig.settings.youtube.is_linked = creds.channels.length > 0;
      globalConfig.settings.youtube.channel_name = activeChannel ? activeChannel.channelName : "";
    }

    {
      const tkCreds = loadTiktokChannels();
      const activeTkChannel = getActiveTiktokChannel(tkCreds);
      globalConfig.settings.tiktok.is_linked = tkCreds.channels.length > 0;
      globalConfig.settings.tiktok.account_name = activeTkChannel
        ? activeTkChannel.channelName
        : tkCreds.legacyAccountName || "";
      globalConfig.settings.tiktok.verification_filename = tkCreds.verification_filename || "";
      globalConfig.settings.tiktok.verification_content = tkCreds.verification_content || "";
      // Keep the static verification file served by web/GFE in sync
      writeTiktokVerificationFiles(process.cwd(), tkCreds);
    }
    
    // Auto-populate YouTube keys from environment/process.env variables
    globalConfig.settings.youtube.client_id = process.env.YOUTUBE_CLIENT_ID || "";
    globalConfig.settings.youtube.api_key = process.env.YOUTUBE_CLIENT_SECRET || "";

    // Auto-populate TikTok keys from environment/process.env variables
    globalConfig.settings.tiktok.client_id = process.env.TIKTOK_CLIENT_KEY || "";
    globalConfig.settings.tiktok.client_secret = process.env.TIKTOK_CLIENT_SECRET || "";

    res.json({ status: 200, message: "ok", data: globalConfig });
  }));

  app.get("/api/v1/local-videos", wrap(async (req: any, res: any) => {
    try {
      const files = fs.readdirSync(LOCAL_VIDEOS_DIR);
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
      const videoFiles = files
        .filter((file) => videoExtensions.includes(path.extname(file).toLowerCase()))
        .map((file) => {
          const stats = fs.statSync(path.join(LOCAL_VIDEOS_DIR, file));
          return {
            name: file,
            size: stats.size,
            path: `storage/local_videos/${file}`
          };
        });
      res.json({ status: 200, message: "ok", data: { files: videoFiles } });
    } catch (err: any) {
      res.status(500).json({ status: 500, message: err.message, data: null });
    }
  }));

  app.post("/api/v1/local-videos/upload", upload.single("video"), wrap(async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 400, message: "No video file provided", data: null });
      }
      res.json({
        status: 200,
        message: "File uploaded successfully",
        data: {
          name: req.file.filename,
          size: req.file.size,
          path: `storage/local_videos/${req.file.filename}`
        }
      });
    } catch (err: any) {
      res.status(500).json({ status: 500, message: err.message, data: null });
    }
  }));

  app.put("/api/v1/config", wrap(async (req: any, res: any) => {
    globalConfig.settings = { ...globalConfig.settings, ...req.body };

    // Save YouTube credentials to .env file if they are passed in from the UI
    if (req.body.youtube) {
      const updates: Record<string, string> = {};
      if (req.body.youtube.client_id !== undefined) {
        updates["YOUTUBE_CLIENT_ID"] = req.body.youtube.client_id;
      }
      if (req.body.youtube.api_key !== undefined) {
        updates["YOUTUBE_CLIENT_SECRET"] = req.body.youtube.api_key;
      }
      if (Object.keys(updates).length > 0) {
        try {
          updateEnvFile(updates);
          console.log("[Config] Updated .env file with YouTube credentials from UI save:", Object.keys(updates));
        } catch (err) {
          console.error("[Config] Failed to update .env file with YouTube credentials:", err);
        }
      }
    }

    // Save TikTok credentials to .env file if they are passed in from the UI
    if (req.body.tiktok) {
      // Persist verification metadata in the credentials repo for durability across restarts
      try {
        let tkCreds = loadTiktokChannels();
        tkCreds = setTiktokVerification(tkCreds, {
          filename: req.body.tiktok.verification_filename,
          content: req.body.tiktok.verification_content,
        });
        if (req.body.tiktok.verification_filename !== undefined) {
          globalConfig.settings.tiktok.verification_filename = req.body.tiktok.verification_filename;
        }
        if (req.body.tiktok.verification_content !== undefined) {
          globalConfig.settings.tiktok.verification_content = req.body.tiktok.verification_content;
        }
        saveTiktokChannels(process.cwd(), tkCreds);
        console.log("[Config] Persisted TikTok verification metadata to disk.");
        writeTiktokVerificationFiles(process.cwd(), tkCreds);
      } catch (err) {
        console.error("[Config] Failed to save verification metadata to tiktok-credentials.json:", err);
      }

      const updates: Record<string, string> = {};
      if (req.body.tiktok.client_id !== undefined) {
        updates["TIKTOK_CLIENT_KEY"] = req.body.tiktok.client_id;
      }
      if (req.body.tiktok.client_secret !== undefined) {
        updates["TIKTOK_CLIENT_SECRET"] = req.body.tiktok.client_secret;
      }
      if (Object.keys(updates).length > 0) {
        try {
          updateEnvFile(updates);
          console.log("[Config] Updated .env file with TikTok credentials from UI save:", Object.keys(updates));
        } catch (err) {
          console.error("[Config] Failed to update .env file with TikTok credentials:", err);
        }
      }
    }

    res.json({ status: 200, message: "ok", data: globalConfig });
  }));

  // 2. Voices APIs
  app.get("/api/v1/voices", wrap(async (req: any, res: any) => {
    const provider = req.query.provider || "";

    let voicesList: { value: string; label: string }[] = [];

    if (provider === "azure-tts-v1" || provider === "edge-tts" || provider === "azure-tts-v2") {
      try {
        const azureVoicesPath = path.join(process.cwd(), "src", "api", "azure_voices.json");
        if (fs.existsSync(azureVoicesPath)) {
          const rawData = fs.readFileSync(azureVoicesPath, "utf-8");
          const azureVoicesList = JSON.parse(rawData);
          voicesList = azureVoicesList.map((item: any) => ({
            value: `${item.name}-${item.gender}`,
            label: `${item.name} (${item.gender})`
          }));
        } else {
          voicesList = [
            { value: "es-ES-AlvaroNeural-Male", label: "es-ES-AlvaroNeural (Male)" },
            { value: "es-ES-ElviraNeural-Female", label: "es-ES-ElviraNeural (Female)" },
            { value: "es-MX-DaliaNeural-Female", label: "es-MX-DaliaNeural (Female)" },
            { value: "es-MX-JorgeNeural-Male", label: "es-MX-JorgeNeural (Male)" },
            { value: "en-US-JennyNeural-Female", label: "en-US-JennyNeural (Female)" },
            { value: "en-US-GuyNeural-Male", label: "en-US-GuyNeural (Male)" },
            { value: "zh-CN-XiaoxiaoNeural-Female", label: "zh-CN-XiaoxiaoNeural (Female)" },
            { value: "zh-CN-YunxiNeural-Male", label: "zh-CN-YunxiNeural (Male)" }
          ];
        }
      } catch (err) {
        console.error("Failed to load azure voices JSON:", err);
      }
    } else if (provider === "siliconflow") {
      voicesList = [
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:alex-Male", label: "alex (Male)" },
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:anna-Female", label: "anna (Female)" },
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:bella-Female", label: "bella (Female)" },
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:benjamin-Male", label: "benjamin (Male)" },
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:charles-Male", label: "charles (Male)" },
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:claire-Female", label: "claire (Female)" },
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:david-Male", label: "david (Male)" },
        { value: "siliconflow:FunAudioLLM/CosyVoice2-0.5B:diana-Female", label: "diana (Female)" }
      ];
    } else if (provider === "gemini-tts") {
      voicesList = [
        { value: "gemini:Zephyr-Female", label: "Zephyr (Female)" },
        { value: "gemini:Puck-Male", label: "Puck (Male)" },
        { value: "gemini:Charon-Male", label: "Charon (Male)" },
        { value: "gemini:Kore-Female", label: "Kore (Female)" },
        { value: "gemini:Fenrir-Male", label: "Fenrir (Male)" },
        { value: "gemini:Aoede-Female", label: "Aoede (Female)" },
        { value: "gemini:Thalia-Female", label: "Thalia (Female)" },
        { value: "gemini:Sage-Male", label: "Sage (Male)" },
        { value: "gemini:Echo-Female", label: "Echo (Female)" },
        { value: "gemini:Harmony-Female", label: "Harmony (Female)" },
        { value: "gemini:Lux-Female", label: "Lux (Female)" },
        { value: "gemini:Nova-Female", label: "Nova (Female)" },
        { value: "gemini:Vale-Male", label: "Vale (Male)" },
        { value: "gemini:Orion-Male", label: "Orion (Male)" },
        { value: "gemini:Atlas-Male", label: "Atlas (Male)" }
      ];
    } else if (provider === "mimo-tts") {
      voicesList = [
        { value: "mimo:mimo_default-Female", label: "mimo_default (Female)" },
        { value: "mimo:冰糖-Female", label: "冰糖 (Female)" },
        { value: "mimo:茉莉-Female", label: "茉莉 (Female)" },
        { value: "mimo:苏打-Male", label: "苏打 (Male)" },
        { value: "mimo:白桦-Male", label: "白桦 (Male)" },
        { value: "mimo:Mia-Female", label: "Mia (Female)" },
        { value: "mimo:Chloe-Female", label: "Chloe (Female)" },
        { value: "mimo:Milo-Male", label: "Milo (Male)" },
        { value: "mimo:Dean-Male", label: "Dean (Male)" }
      ];
    } else {
      // Default fallback
      voicesList = [
        { value: "Zephyr-Female", label: "Zephyr (Female)" },
        { value: "Kore-Female", label: "Kore (Female)" },
        { value: "Puck-Male", label: "Puck (Male)" },
        { value: "Fenrir-Male", label: "Fenrir (Male)" },
        { value: "Charon-Male", label: "Charon (Male)" }
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

  function getFallbackScript(subject: string, paragraph_number: number): string {
    const fallbackParagraphs = [
      `Bienvenidos a este viaje fascinante y profundamente revelador por el maravilloso mundo de ${subject}. En este relato, nos disponemos a desentrañar los secretos más asombrosos, las leyendas ocultas y los acontecimientos históricos que han dado forma a este tema y que despiertan una inmensa pasión en todos aquellos que se atreven a explorarlo con una mirada curiosa y atenta.`,
      `Al adentrarnos en las profundidades de ${subject}, comenzamos a descubrir detalles verdaderamente sorprendentes que desafían lo unconventional y cambian por completo nuestra percepción cotidiana de la realidad. Es un espectáculo absolutamente asombroso contemplar cómo la ciencia rigurosa, la majestuosidad de la naturaleza indómita y la chispa inagotable de la creatividad humana se entrelazan de manera perfecta para crear algo único.`,
      `Cada rincón y cada época relacionados con ${subject} albergan lecciones valiosas de perseverancia, ingenio y misterio. A través de los años, grandes pensadores y exploradores dedicaron sus vidas enteras a comprender estas dinámicas, dejando un legado imborrable que hoy en día continúa inspirando a nuevas generaciones de entusiastas en todo el planeta.`,
      `Además, el impacto cultural y social de ${subject} no solo se limita al pasado, sino que sigue moldeando activamente nuestras interacciones modernas y la forma en que concebimos el mañana. Comprender su esencia misma nos permite conectar con un propósito mayor, reconociendo las influencias invisibles pero poderosas que guían constantemente nuestras decisiones y nuestra evolución colectiva.`,
      `Es fascinante observar cómo las diferentes corrientes de pensamiento han convergido en torno a ${subject}, aportando cada una de ellas una perspectiva valiosa y única que enriquece el debate global. Desde las aplicaciones más prácticas del día a día hasta las teorías más abstractas de la filosofía y el arte, este campo de estudio se consolida como un puente indispensable entre diversas disciplinas del saber humano.`,
      `A medida que la tecnología y la investigación avanzan a pasos agigantados, nuevas dimensiones de ${subject} comienzan a revelarse ante nuestros ojos, planteando desafíos emocionantes y oportunidades sin precedentes. Los expertos coinciden en que apenas estamos rozando la superficie de lo que es posible alcanzar, lo que convierte a esta disciplina en un terreno sumamente fértil para la innovación y el descubrimiento continuo.`,
      `Por otro lado, la vertiente humana de ${subject} nos recuerda la importancia de la empatía, la colaboración y el esfuerzo compartido en la construcción de un futuro más próspero. Las grandes historias de éxito asociadas a este ámbito suelen estar protagonizadas por personas comunes que, impulsadas por una visión extraordinaria, lograron superar barreras aparentemente insalvables.`,
      `Al reflexionar con mayor profundidad sobre la trascendencia de ${subject}, nos damos cuenta de que cada pequeño avance en esta materia contribuye a tejer una red global de conocimiento interconectado. Esta sinergia no solo acelera el progreso técnico, sino que también fomenta un entendimiento más profundo y compasivo entre las diversas comunidades que cohabitan en nuestro planeta.`,
      `De cara a los próximos años, se vislumbra que ${subject} jugará un papel crucial en la resolución de algunos de los interrogantes más complejos del nuevo milenio. Estar preparados para comprender estos cambios y adaptarnos a ellos con flexibilidad será, sin duda, una de las habilidades más valiosas para las generaciones venideras.`,
      `Esperamos sinceramente que hayan disfrutado al máximo de este enriquecedor recorrido lleno de aprendizaje y asombro por el universo de ${subject}. Los invitamos cordialmente a seguir explorando este y otros enigmas con la mente abierta, recordando siempre que la curiosidad insaciable es el verdadero motor que impulsa el conocimiento humano hacia horizontes infinitos.`
    ];

    return fallbackParagraphs.slice(0, paragraph_number).join("\n\n");
  }

  app.post("/api/v1/voices/preview", wrap(async (req: any, res: any) => {
    const voice_name = req.body.voice_name || "";
    const text = req.body.text || "Hola, probando esta voz.";
    const voice_rate = req.body.voice_rate !== undefined ? req.body.voice_rate : 1.0;
    const voice_volume = req.body.voice_volume !== undefined ? req.body.voice_volume : 1.0;

    let tl = "es"; // default to Spanish
    const voiceNameLower = voice_name.toLowerCase();
    
    if (voiceNameLower.includes("en-") || voiceNameLower.includes("us-") || voiceNameLower.includes("guy") || voiceNameLower.includes("jenny") || voiceNameLower.includes("alex") || voiceNameLower.includes("anna") || voiceNameLower.includes("bella") || voiceNameLower.includes("benjamin") || voiceNameLower.includes("charles") || voiceNameLower.includes("claire") || voiceNameLower.includes("david") || voiceNameLower.includes("diana") || voiceNameLower.includes("milo") || voiceNameLower.includes("dean") || voiceNameLower.includes("chloe") || voiceNameLower.includes("mia") || voiceNameLower.includes("puck") || voiceNameLower.includes("charon") || voiceNameLower.includes("zephyr")) {
      tl = "en";
    } else if (voiceNameLower.includes("zh-") || voiceNameLower.includes("cn-") || voiceNameLower.includes("xiaoxiao") || voiceNameLower.includes("yunxi") || voiceNameLower.includes("冰糖") || voiceNameLower.includes("茉莉") || voiceNameLower.includes("苏打") || voiceNameLower.includes("白桦")) {
      tl = "zh-CN";
    } else if (voiceNameLower.includes("es-") || voiceNameLower.includes("mx-") || voiceNameLower.includes("alvaro") || voiceNameLower.includes("elvira") || voiceNameLower.includes("dalia") || voiceNameLower.includes("jorge")) {
      tl = "es";
    } else if (voiceNameLower.includes("pt-") || voiceNameLower.includes("br-")) {
      tl = "pt";
    } else if (voiceNameLower.includes("de-")) {
      tl = "de";
    } else if (voiceNameLower.includes("fr-")) {
      tl = "fr";
    } else if (voiceNameLower.includes("it-")) {
      tl = "it";
    } else if (voiceNameLower.includes("ru-")) {
      tl = "ru";
    } else if (voiceNameLower.includes("ja-") || voiceNameLower.includes("jp-")) {
      tl = "ja";
    } else {
      // Check first two chars of voice_name, e.g. "af-ZA-AdriNeural" -> "af"
      const parts = voice_name.split("-");
      if (parts[0] && parts[0].length === 2) {
        tl = parts[0];
      }
    }

    try {
      const audioBuffer = await synthesizeSpeech(voice_name, text, tl, voice_rate, voice_volume);
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (err) {
      console.error("Error fetching preview audio, falling back to silent wave:", err);
      // Fallback to a locally generated valid short silent WAV file so it never fails!
      const waveHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x08, 0x00, 0x00, // Chunk size
        0x57, 0x41, 0x56, 0x45, // "WAVE"
        0x66, 0x6d, 0x74, 0x20, // "fmt "
        0x10, 0x00, 0x00, 0x00, // Subchunk1Size
        0x01, 0x00,             // AudioFormat: PCM
        0x01, 0x00,             // NumChannels: Mono
        0x40, 0x1f, 0x00, 0x00, // SampleRate: 8000
        0x40, 0x1f, 0x00, 0x00, // ByteRate: 8000
        0x01, 0x00,             // BlockAlign
        0x08, 0x00,             // BitsPerSample: 8
        0x64, 0x61, 0x74, 0x61, // "data"
        0x00, 0x08, 0x00, 0x00  // Subchunk2Size
      ]);
      const waveData = Buffer.alloc(2048, 128); // 128 is silence in 8-bit PCM
      res.setHeader("Content-Type", "audio/wav");
      res.send(Buffer.concat([waveHeader, waveData]));
    }
  }));

  // 3. LLM APIs (Scripts & Terms)
  app.post("/api/v1/scripts", wrap(async (req: any, res: any) => {
    const {
      video_subject,
      video_language = "es",
      paragraph_number = 3,
      video_script_prompt = "",
      custom_system_prompt = ""
    } = req.body;

    const llmProvider = process.env.LLM_PROVIDER || "gemini";
    if (llmProvider === "gemini" && !process.env.GEMINI_API_KEY) {
      throw new Error("No Gemini API key configured. Please set GEMINI_API_KEY.");
    }

    let prompt = `Escribe un guión de video sobre "${video_subject}" en idioma ${video_language}. Es CRÍTICO que el guión tenga exactamente ${paragraph_number} párrafos bien estructurados, completos y detallados.
Cada párrafo debe ser sustancial y desarrollado por completo (debe tener un rango estricto de entre 45 y 55 palabras por párrafo, compuesto por 3 a 5 oraciones ricas y descriptivas, óptimo para narrar una historia o un documental).
La longitud total del guión completo debe ser de aproximadamente ${paragraph_number * 45} a ${paragraph_number * 55} palabras en total. A medida que aumenta el número de párrafos, el guión general debe ser proporcionalmente más largo de forma lineal y acumulativa (por ejemplo, 3 párrafos deben sumar unas 150 palabras en total, y 4 párrafos deben sumar unas 200 palabras en total). No reduzcas la longitud de los párrafos individuales al tener más párrafos; cada uno de ellos debe mantener de forma consistente la profundidad, extensión y cantidad de palabras especificadas.
Separa cada párrafo estrictamente con dos saltos de línea (\\n\\n). Devuelve SOLAMENTE el texto del guión, sin títulos, introducciones ni comentarios adicionales.

CRÍTICO: No utilices NINGÚN tipo de formato de texto como asteriscos (* o **), comillas (" o “ o ”) o palabras entre paréntesis o corchetes, ya que el guión se usará directamente con un generador de voz automática y estos caracteres provocan lecturas raras. Escribe solo texto limpio y natural.`;

    if (video_script_prompt) {
      prompt += `\n\nInstrucciones adicionales para el guión:\n${video_script_prompt}`;
    }

    let finalSystemPrompt = custom_system_prompt;
    if (finalSystemPrompt && paragraph_number) {
      finalSystemPrompt += `\n\n[INSTRUCCIÓN DE PRIORIDAD ABSOLUTA PARA EL NÚMERO DE PÁRRAFOS]: El usuario ha solicitado exactamente ${paragraph_number} párrafos. Ignora cualquier restricción de límite de palabras total anterior (como "extensión total de entre 120 y 140 palabras" o similar). En su lugar, aplica ese límite de palabras a cada párrafo de manera individual (es decir, cada uno de los ${paragraph_number} párrafos debe tener unas 45-55 palabras de forma consistente). El guion completo debe crecer de manera lineal y proporcional (aproximadamente de ${paragraph_number * 45} a ${paragraph_number * 55} palabras en total) para asegurar que la duración de la locución aumente según la cantidad de párrafos solicitados.`;
    }

    const rawScript = await generateLlmContent(prompt, false, finalSystemPrompt || undefined);
    const scriptText = cleanScriptSymbols(rawScript);

    res.json({ status: 200, message: "ok", data: { video_script: scriptText } });
  }));

  app.post("/api/v1/terms", wrap(async (req: any, res: any) => {
    const { video_subject, video_script = "" } = req.body;
    const llmProvider = process.env.LLM_PROVIDER || "gemini";
    if (llmProvider === "gemini" && !process.env.GEMINI_API_KEY) {
      throw new Error("No Gemini API key configured. Please set GEMINI_API_KEY.");
    }

    const prompt = `Analiza el siguiente guión de video y genera una lista de exactamente 5 términos de búsqueda en inglés (para buscar videos de stock relevantes). Devuelve una respuesta JSON con el formato: { "terms": ["term1", "term2", ...] }. Guión: ${video_script}`;
    const resp = await generateLlmContent(prompt, true);
    const parsed = JSON.parse(resp);
    const terms = parsed.terms || [];

    res.json({ status: 200, message: "ok", data: { video_terms: terms } });
  }));

  app.post("/api/v1/hashtags", wrap(async (req: any, res: any) => {
    const { video_terms, video_subject = "", video_script = "" } = req.body;
    const llmProvider = process.env.LLM_PROVIDER || "gemini";
    if (llmProvider === "gemini" && !process.env.GEMINI_API_KEY) {
      throw new Error("No Gemini API key configured. Please set GEMINI_API_KEY.");
    }

    const keywords = Array.isArray(video_terms) ? video_terms.join(", ") : (video_terms || "");
    const prompt = `Genera hashtags de alto impacto para la descripción de un YouTube Short.
Palabras clave (keywords): ${keywords}
Tema del video: ${video_subject}
Guión: ${video_script}

Instrucciones:
- Genera hashtags de alto impacto para YouTube Shorts, combinando inglés y español de forma óptima para audiencia hispana.
- Todos los hashtags deben estar en minúsculas.
- El formato final debe ser una sola línea de hashtags separados por un espacio, por ejemplo: "#hashtag1 #hashtag2 #hashtag3" (sin comas ni saltos de línea).
- Devuelve la respuesta en formato JSON estructurado: { "hashtags": "#hashtag1 #hashtag2 #hashtag3" }`;

    const resp = await generateLlmContent(prompt, true);
    let hashtags = "";
    try {
      const parsed = JSON.parse(resp);
      hashtags = parsed.hashtags || "";
    } catch (e) {
      hashtags = resp.trim();
    }

    res.json({ status: 200, message: "ok", data: { hashtags } });
  }));

  // Helper to dynamically build redirect URI for YouTube OAuth
  const getRedirectUri = (req: any) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${protocol}://${host}/api/v1/youtube/callback`;
  };

  // YouTube OAuth URL Endpoint
  app.get("/api/v1/youtube/auth-url", wrap(async (req: any, res: any) => {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        status: 400,
        message: "Las credenciales YOUTUBE_CLIENT_ID o YOUTUBE_CLIENT_SECRET no están configuradas en el archivo .env."
      });
    }

    const redirectUri = getRedirectUri(req);
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly"
      ],
      prompt: "consent"
    });

    res.json({ status: 200, message: "ok", data: { url: authUrl } });
  }));

  // YouTube OAuth Callback Route
  app.get("/api/v1/youtube/callback", wrap(async (req: any, res: any) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Código de autorización faltante.");
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = getRedirectUri(req);

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Fetch channel info
    let channelName = "Mi Canal de YouTube";
    let channelId = "unknown";
    try {
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const response = await youtube.channels.list({
        part: ["id", "snippet"],
        mine: true
      });
      channelId = response.data.items?.[0]?.id || "unknown";
      channelName = response.data.items?.[0]?.snippet?.title || "Mi Canal de YouTube";
    } catch (err) {
      console.error("Error al obtener información del canal:", err);
    }

    // Save credentials to local storage
    const creds = upsertChannel(loadChannels(), { channelId, channelName, tokens });
    saveChannels(process.cwd(), creds);

    // Send postMessage to closing popup
    res.send(`
      <html>
        <head>
          <title>Autenticación Exitosa</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #121214; color: #ffffff; margin: 0; }
            h2 { color: #10B981; }
            p { color: #A1A1AA; }
          </style>
        </head>
        <body>
          <h2>¡Autenticación Exitosa!</h2>
          <p>Tu cuenta de YouTube has sido vinculada correctamente (${channelName}).</p>
          <p>Esta ventana se cerrará automáticamente en unos segundos...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS', channelName: ${JSON.stringify(channelName)} }, '*');
              setTimeout(() => { window.close(); }, 1500);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  }));

  // YouTube OAuth Status Endpoint
  app.get("/api/v1/youtube/status", wrap(async (req: any, res: any) => {
    const creds = loadChannels();
    const activeChannel = getActiveChannel(creds);
    return res.json({
      status: 200,
      message: "ok",
      data: {
        is_linked: creds.channels.length > 0,
        channel_name: activeChannel ? activeChannel.channelName : null,
        active_channel_id: activeChannel ? activeChannel.channelId : null,
        channels: creds.channels.map((c) => ({ channelId: c.channelId, channelName: c.channelName }))
      }
    });
  }));

  // YouTube OAuth Disconnect Endpoint
  app.post("/api/v1/youtube/disconnect", wrap(async (req: any, res: any) => {
    saveChannels(process.cwd(), { activeChannelId: null, channels: [] });
    return res.json({ status: 200, message: "ok" });
  }));

  // YouTube OAuth Select Active Channel Endpoint
  app.post("/api/v1/youtube/select-channel", wrap(async (req: any, res: any) => {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ status: 400, message: "Falta el channelId." });
    }

    const creds = loadChannels();
    if (creds.channels.length === 0) {
      return res.status(404).json({ status: 404, message: "No se encontraron credenciales de YouTube." });
    }

    try {
      const updated = selectChannel(creds, channelId);
      if (!updated) {
        return res.status(404).json({ status: 404, message: "Canal no encontrado en las cuentas vinculadas." });
      }

      saveChannels(process.cwd(), updated);
      return res.json({ status: 200, message: "ok", activeChannelId: channelId });
    } catch (e: any) {
      return res.status(500).json({ status: 500, message: e.message });
    }
  }));

  // YouTube OAuth Disconnect Single Channel Endpoint
  app.post("/api/v1/youtube/disconnect-channel", wrap(async (req: any, res: any) => {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ status: 400, message: "Falta el channelId." });
    }

    const creds = loadChannels();
    if (creds.channels.length === 0) {
      return res.status(404).json({ status: 404, message: "No se encontraron credenciales de YouTube." });
    }

    try {
      saveChannels(process.cwd(), removeChannel(creds, channelId));
      return res.json({ status: 200, message: "ok" });
    } catch (e: any) {
      return res.status(500).json({ status: 500, message: e.message });
    }
  }));

  // YouTube Video Upload Endpoint
  app.post("/api/v1/youtube/upload", wrap(async (req: any, res: any) => {
    const { videoUrl, title, description, privacyStatus = "private", publishAt } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ status: 400, message: "Falta el videoUrl del video a subir." });
    }

    const creds = loadChannels();
    if (creds.channels.length === 0) {
      return res.status(401).json({ status: 401, message: "YouTube no está vinculado. Por favor, vincúlalo primero." });
    }

    const activeChannel = getActiveChannel(creds);
    if (!activeChannel) {
      return res.status(401).json({ status: 401, message: "YouTube no está vinculado o el canal activo no existe." });
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = getRedirectUri(req);

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials(activeChannel.tokens);

    // Handle token refresh events automatically
    oauth2Client.on("tokens", (newTokens) => {
      activeChannel.tokens = { ...activeChannel.tokens, ...newTokens };
      saveChannels(process.cwd(), creds);
    });

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Locate file on disk
    const filePath = path.join(process.cwd(), videoUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 404, message: `No se encontró el archivo de video en el disco: ${filePath}` });
    }

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: title || "YouTube Short",
          description: description || "Creado con MoneyPrinter Turbo",
          tags: ["shorts", "moneyprinter", "turbo"],
          categoryId: "22" // People & Blogs
        },
        status: {
          privacyStatus: publishAt ? "private" : (privacyStatus || "private"),
          publishAt: publishAt || undefined,
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(filePath)
      }
    });

    res.json({
      status: 200,
      message: "ok",
      data: {
        videoId: response.data.id,
        url: `https://youtu.be/${response.data.id}`
      }
    });
  }));

  // Helper to dynamically build redirect URI for TikTok OAuth
  const getTikTokRedirectUri = (req: any) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${protocol}://${host}/api/v1/tiktok/callback`;
  };

  // TikTok OAuth URL Endpoint
  app.get("/api/v1/tiktok/auth-url", wrap(async (req: any, res: any) => {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
      return res.status(400).json({
        status: 400,
        message: "La credencial TIKTOK_CLIENT_KEY no está configurada en el archivo .env."
      });
    }

    const redirectUri = encodeURIComponent(getTikTokRedirectUri(req));
    const scope = encodeURIComponent("user.info.basic,video.upload,video.publish");
    const state = Math.random().toString(36).substring(2);
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&redirect_uri=${redirectUri}&response_type=code&state=${state}`;

    res.json({ status: 200, message: "ok", data: { url: authUrl } });
  }));

  // TikTok OAuth Callback Endpoint
  app.get("/api/v1/tiktok/callback", wrap(async (req: any, res: any) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Falta el parámetro 'code' de autorización.");
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
      return res.status(400).send("Las credenciales TIKTOK_CLIENT_KEY o TIKTOK_CLIENT_SECRET no están configuradas.");
    }

    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code as string,
        grant_type: "authorization_code",
        redirect_uri: getTikTokRedirectUri(req)
      }).toString()
    });

    const tokenData: any = await tokenResponse.json();
    if (!tokenData.access_token) {
      return res.status(400).send("Error al obtener token de acceso de TikTok: " + JSON.stringify(tokenData));
    }

    // Fetch TikTok user profile details
    const profileResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=avatar_url,display_name,username,open_id", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`
      }
    });
    const profileData: any = await profileResponse.json();
    const user = profileData?.data?.user;
    const channelId = user?.open_id || "unknown";
    const channelName = user?.display_name || user?.username || "Usuario de TikTok";
    const username = user?.username || "";
    const avatarUrl = user?.avatar_url || "";

    // Save credentials via the repo (preserves verification metadata)
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      refresh_expires_at: Date.now() + (tokenData.refresh_expires_in * 1000)
    };

    let tkCreds = loadTiktokChannels();
    tkCreds = upsertTiktokChannel(tkCreds, { channelId, channelName, username, avatarUrl, tokens });
    saveTiktokChannels(process.cwd(), tkCreds);

    // Send postMessage to closing popup
    res.send(`
      <html>
        <head>
          <title>Autenticación Exitosa</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #121214; color: #ffffff; margin: 0; }
            h2 { color: #10B981; }
            p { color: #A1A1AA; }
          </style>
        </head>
        <body>
          <h2>¡Autenticación Exitosa!</h2>
          <p>Tu cuenta de TikTok ha sido vinculada correctamente (@${username || channelName}).</p>
          <p>Esta ventana se cerrará automáticamente en unos segundos...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'TIKTOK_AUTH_SUCCESS', channelName: ${JSON.stringify(channelName)} }, '*');
              setTimeout(() => { window.close(); }, 1500);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  }));

  // TikTok OAuth Status Endpoint
  app.get("/api/v1/tiktok/status", wrap(async (req: any, res: any) => {
    const tkCreds = loadTiktokChannels();
    const activeChannel = getActiveTiktokChannel(tkCreds);

    return res.json({
      status: 200,
      message: "ok",
      data: {
        is_linked: tkCreds.channels.length > 0,
        channel_name: activeChannel ? activeChannel.channelName : null,
        active_channel_id: activeChannel ? activeChannel.channelId : null,
        channels: tkCreds.channels.map((c) => ({ channelId: c.channelId, channelName: c.channelName, username: c.username, avatarUrl: c.avatarUrl }))
      }
    });
  }));

  // TikTok OAuth Disconnect Endpoint
  app.post("/api/v1/tiktok/disconnect", wrap(async (req: any, res: any) => {
    clearTiktokCredentials(process.cwd());
    return res.json({ status: 200, message: "ok" });
  }));

  // TikTok OAuth Select Active Channel Endpoint
  app.post("/api/v1/tiktok/select-channel", wrap(async (req: any, res: any) => {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ status: 400, message: "Falta el channelId." });
    }

    const tkCreds = loadTiktokChannels();
    if (tkCreds.channels.length === 0) {
      return res.status(404).json({ status: 404, message: "No se encontraron credenciales de TikTok." });
    }

    const updated = selectTiktokChannel(tkCreds, channelId);
    if (!updated) {
      return res.status(404).json({ status: 404, message: "Cuenta no encontrada en las cuentas vinculadas." });
    }

    saveTiktokChannels(process.cwd(), updated);
    return res.json({ status: 200, message: "ok", activeChannelId: channelId });
  }));

  // TikTok OAuth Disconnect Single Channel Endpoint
  app.post("/api/v1/tiktok/disconnect-channel", wrap(async (req: any, res: any) => {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ status: 400, message: "Falta el channelId." });
    }

    const tkCreds = loadTiktokChannels();
    if (tkCreds.channels.length === 0) {
      return res.status(404).json({ status: 404, message: "No se encontraron credenciales de TikTok." });
    }

    saveTiktokChannels(process.cwd(), removeTiktokChannel(tkCreds, channelId));
    return res.json({ status: 200, message: "ok" });
  }));

  // TikTok Video Upload/Publish Endpoint
  app.post("/api/v1/tiktok/upload", wrap(async (req: any, res: any) => {
    const { videoUrl, title } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ status: 400, message: "Falta el videoUrl del video a subir." });
    }

    const tkCreds = loadTiktokChannels();
    if (tkCreds.channels.length === 0) {
      return res.status(401).json({ status: 401, message: "TikTok no está vinculado. Por favor, vincúlalo primero." });
    }

    const activeChannel = getActiveTiktokChannel(tkCreds);
    if (!activeChannel) {
      return res.status(401).json({ status: 401, message: "TikTok no está vinculado o la cuenta activa no existe." });
    }

    let accessToken = activeChannel.tokens.access_token;
    if (activeChannel.tokens.expires_at && Date.now() >= activeChannel.tokens.expires_at) {
      console.log("[TikTok] Access token expired, trying to refresh...");
      try {
        const refreshResp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY || "",
            client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
            grant_type: "refresh_token",
            refresh_token: activeChannel.tokens.refresh_token
          }).toString()
        });
        const refreshData: any = await refreshResp.json();
        if (refreshData.access_token) {
          activeChannel.tokens.access_token = refreshData.access_token;
          activeChannel.tokens.refresh_token = refreshData.refresh_token;
          activeChannel.tokens.expires_at = Date.now() + (refreshData.expires_in * 1000);
          saveTiktokChannels(process.cwd(), tkCreds);
          accessToken = refreshData.access_token;
          console.log("[TikTok] Access token refreshed successfully.");
        } else {
          console.error("[TikTok] Failed to refresh token:", refreshData);
        }
      } catch (err) {
        console.error("[TikTok] Error during token refresh:", err);
      }
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const cleanPath = videoUrl.replace(/^\//, "");
    const publicVideoUrl = `${protocol}://${host}/${cleanPath}`;

    console.log(`[TikTok] Initializing direct post upload for ${publicVideoUrl}`);

    const tiktokInitUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";
    const tiktokInitResponse = await fetch(tiktokInitUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({
        post_info: {
          title: title || "Video Short #moneyprinter",
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: publicVideoUrl
        }
      })
    });

    const initData: any = await tiktokInitResponse.json();
    console.log("[TikTok] Init response:", initData);

    if (initData.error && initData.error.code !== "ok") {
      return res.status(400).json({
        status: 400,
        message: initData.error.message || "Error al subir video a TikTok"
      });
    }

    res.json({
      status: 200,
      message: "ok",
      data: {
        publishId: initData.data?.publish_id || "",
        url: `https://www.tiktok.com/@${activeChannel.username || ""}`
      }
    });
  }));

  // 4. Tasks APIs (Videos generator)
  const logTask = (taskId: string, level: "INFO" | "SUCCESS" | "WARNING" | "ERROR", category: string, message: string) => {
    const t = tasks.get(taskId);
    if (t) {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestamp}] [${level}] [${category.toUpperCase()}] ${message}`;
      if (!t.logs) t.logs = [];
      t.logs.push(logLine);
      console.log(`Task ${taskId}: ${logLine}`);
      tasks.set(taskId, t);
    }
  };

  app.get("/api/v1/musics", wrap(async (req: any, res: any) => {
    res.json({ status: 200, message: "ok", data: { files: BGM_FILES } });
  }));

  // 5. Projects APIs
  app.get("/api/v1/projects", wrap(async (req: any, res: any) => {
    // Automatically clean up projects whose storage folders have been deleted
    for (const [projectId, p] of Array.from(projects.entries())) {
      if (p.project_folder_name) {
        const folderPath = path.join(process.cwd(), "storage", "renders", p.project_folder_name);
        if (!fs.existsSync(folderPath)) {
          projects.delete(projectId);
        }
      }
    }
    const list = Array.from(projects.values()).map(p => ({
      project_id: p.project_id,
      topic: p.topic || "Untitled Project",
      updated_at: p.updated_at
    }));
    res.json({ status: 200, message: "ok", data: { projects: list } });
  }));

  app.post("/api/v1/projects/from-topic", wrap(async (req: any, res: any) => {
    const { topic, language = "es", generate_script = true, paragraph_number = 3 } = req.body;
    const projectId = "proj_" + Math.random().toString(36).substring(2, 9);

    let scriptText = "";
    if (generate_script) {
      const llmProvider = process.env.LLM_PROVIDER || "gemini";
      if (llmProvider === "gemini" && !process.env.GEMINI_API_KEY) {
        throw new Error("No Gemini API key configured. Please set GEMINI_API_KEY.");
      }
      const prompt = `Escribe un guión para un video de TikTok sobre "${topic}" en idioma ${language}.
El objetivo es que el espectador sienta que alguien le está contando una historia fascinante cara a cara.
Usa un tono cercano, natural y conversacional. Escribe con palabras simples, evitando tecnicismos, frases demasiado largas o vocabulario rebuscado. Si aparece un concepto difícil, explícalo de forma sencilla sin perder el ritmo.
Haz que el relato despierte curiosidad desde las primeras líneas y mantenga la tensión durante todo el video. Alterna momentos de sorpresa, intriga y reflexión cuando sea apropiado, pero sin exagerar ni inventar hechos.
No escribas como un artículo de Wikipedia ni como un documental académico. Escribe como un buen narrador que sabe mantener la atención de quien escucha.
Es CRÍTICO que el guión tenga EXACTAMENTE ${paragraph_number} párrafos, separados únicamente por dos saltos de línea (\\n\\n).
Cada párrafo debe ser sustancial y desarrollado por completo (aproximadamente de 50 a 70 palabras por párrafo, compuesto por 3 a 5 oraciones ricas y descriptivas).
A medida que aumenta el número de párrafos, el guión general debe ser proporcionalmente más largo; bajo ninguna circunstancia acortes ni apresures los párrafos individuales al tener más de ellos. Cada párrafo debe mantener la misma profundidad, extensión y desarrollo completo de una parte de la historia con transiciones naturales hacia el siguiente.
No repitas información. No uses relleno. Cada frase debe aportar algo interesante.
Devuelve ÚNICAMENTE el texto del guión, sin títulos, encabezados, listas, notas ni comentarios adicionales.

CRÍTICO: No utilices NINGÚN tipo de formato de texto como asteriscos (* o **), comillas (" o “ o ”) o palabras entre paréntesis o corchetes, ya que el guión se usará directamente con un generador de voz automática y estos caracteres provocan lecturas raras. Escribe solo texto limpio y natural.`;
      const rawScript = await generateLlmContent(prompt);
      scriptText = cleanScriptSymbols(rawScript);
    }

    const newProject = {
      project_id: projectId,
      topic: topic,
      language: language,
      script: scriptText,
      has_script: !!scriptText,
      has_shot_plan: false,
      has_selected_media: false,
      has_timeline: false,
      tracks: [],
      selected_media: [],
      media_candidates: [],
      selected_music: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    projects.set(projectId, newProject);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: projectId, has_script: !!scriptText, source_kind: "topic" }
    });
  }));

  app.post("/api/v1/projects/from-script", wrap(async (req: any, res: any) => {
    const { script, topic = "Video Script", language = "es" } = req.body;
    const projectId = "proj_" + Math.random().toString(36).substring(2, 9);

    const newProject = {
      project_id: projectId,
      topic: topic || "Guión de Video",
      language: language,
      script: cleanScriptSymbols(script),
      has_script: true,
      has_shot_plan: false,
      has_selected_media: false,
      has_timeline: false,
      tracks: [],
      selected_media: [],
      media_candidates: [],
      selected_music: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    projects.set(projectId, newProject);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: projectId, has_script: true, source_kind: "script" }
    });
  }));

  app.post("/api/v1/projects/from-reddit", wrap(async (req: any, res: any) => {
    const { url, title, body, language = "es" } = req.body;
    const projectId = "proj_" + Math.random().toString(36).substring(2, 9);
    const script = cleanScriptSymbols(`${title}\n\n${body}`);

    const newProject = {
      project_id: projectId,
      topic: title || "Reddit Post",
      language: language,
      script: script,
      has_script: true,
      has_shot_plan: false,
      has_selected_media: false,
      has_timeline: false,
      tracks: [],
      selected_media: [],
      media_candidates: [],
      selected_music: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    projects.set(projectId, newProject);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: projectId, has_script: true, source_kind: "reddit" }
    });
  }));

  app.get("/api/v1/projects/:id", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    // Auto-fix audio track if it's missing but we have tracks and segments
    if (p.tracks && !p.tracks.some((t: any) => t.type === "audio") && p.shot_plan?.segments) {
      const audioItems = (p.shot_plan?.segments || []).map((seg: any, idx: number) => {
        const startSec = seg.start_sec !== undefined ? seg.start_sec : idx * 5;
        const durationSec = seg.target_duration_sec !== undefined ? seg.target_duration_sec : 5;
        return {
          id: `audio_${idx + 1}`,
          start_sec: startSec,
          duration_sec: durationSec,
          text: seg.narration_text,
          segment_id: seg.id,
          asset_url: p.narration_audio_path || null
        };
      });
      p.tracks.push({
        id: "track_audio",
        type: "audio",
        name: "Audio Track",
        items: audioItems
      });
      projects.set(req.params.id, p);
    }

    res.json({ status: 200, message: "ok", data: { ...p, timeline: p } });
  }));

  app.delete("/api/v1/projects/:id", wrap(async (req: any, res: any) => {
    projects.delete(req.params.id);
    res.json({ status: 200, message: "ok", data: { project_id: req.params.id, deleted: true } });
  }));

  app.patch("/api/v1/projects/:id/metadata", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    p.topic = req.body.topic;
    p.updated_at = new Date().toISOString();
    projects.set(req.params.id, p);
    res.json({ status: 200, message: "ok", data: { project_id: p.project_id, topic: p.topic } });
  }));

  app.post("/api/v1/projects/:id/duplicate", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const newId = "proj_" + Math.random().toString(36).substring(2, 9);
    const duplicated = JSON.parse(JSON.stringify(p));
    duplicated.project_id = newId;
    duplicated.topic = p.topic + " Copy";
    duplicated.created_at = new Date().toISOString();
    duplicated.updated_at = new Date().toISOString();
    projects.set(newId, duplicated);
    res.json({ status: 200, message: "ok", data: { project_id: newId } });
  }));

  app.put("/api/v1/projects/:id", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    if (req.body && req.body.script) {
      req.body.script = cleanScriptSymbols(req.body.script);
    }
    const updated = { ...p, ...req.body };
    const oldNiche = p.params?.video_niche;
    const newNiche = updated.params?.video_niche;
    if (!updated.project_folder_name || (newNiche && oldNiche !== newNiche)) {
      const themeFolder = sanitizeFolderName(newNiche || updated.topic || 'general');
      const folderName = `${sanitizeFolderName(updated.topic || updated.project_id || 'project')}_${getFormattedDateTime()}`;
      updated.project_folder_name = `${themeFolder}/${folderName}`;
    }
    updated.updated_at = new Date().toISOString();
    projects.set(req.params.id, updated);
    res.json({ status: 200, message: "ok", data: { project_id: p.project_id } });
  }));

  app.post("/api/v1/projects/:id/plan", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    const clipDuration = Number(req.body.target_duration_sec) || Number(p.params?.video_clip_duration) || 5;

    const sentences = (p.script || p.topic || "")
      .split(/[.!?]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 5);

    const rawTerms = p.params?.video_terms || p.video_terms || "";
    let userTerms: string[] = [];
    if (Array.isArray(rawTerms)) {
      userTerms = rawTerms.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof rawTerms === "string" && rawTerms.trim()) {
      userTerms = rawTerms.split(",").map((t: string) => t.trim()).filter(Boolean);
    }

    console.log(`[Plan] Project ${req.params.id} loaded. Custom video_terms parsed:`, userTerms);

    let searchQueriesForSegments: string[][] = [];
    let hasGeminiQueries = false;

    const currentLlmProvider = process.env.LLM_PROVIDER || "gemini";
    if (process.env.GEMINI_API_KEY || currentLlmProvider === "lmstudio" || currentLlmProvider === "openai") {
      try {
        const prompt = `Analiza las siguientes oraciones de un guión de video en idioma "${p.language || "es"}":
${sentences.map((s, i) => `Segmento ${i + 1}: "${s}"`).join("\n")}

Tema general del video: "${p.topic || ""}"
Palabras clave/Términos de video preferidos del usuario: "${userTerms.join(", ")}"

Para cada segmento, genera exactamente de 1 a 3 palabras clave o frases cortas de búsqueda en INGLÉS súper relevantes, descriptivas y visuales para buscar videos de stock en Pexels que coincidan con la oración y el tema general.
Es sumamente importante que las palabras clave de búsqueda estén en INGLÉS para que la API de Pexels funcione de la mejor manera.

Devuelve estrictamente un arreglo JSON de arreglos de cadenas (strings), con exactamente un arreglo de palabras clave para cada uno de los ${sentences.length} segmentos.
Ejemplo de formato de respuesta:
[
  ["vintage computer", "retro technology"],
  ["group of people cheering", "celebration"]
]
No incluyas explicaciones, marcas de código markdown, ni texto adicional, solo el JSON puro.`;

        const responseText = await generateLlmContent(prompt);
        const cleanedText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        if (Array.isArray(parsed) && parsed.length === sentences.length) {
          searchQueriesForSegments = parsed;
          hasGeminiQueries = true;
          console.log("[Plan] Generated high-quality segment search queries using Gemini:", searchQueriesForSegments);
        }
      } catch (err) {
        console.error("[Plan] Failed to generate search queries using Gemini, falling back to local heuristic:", err);
      }
    }

    const segments = sentences.map((sentence: string, idx: number) => {
      let segmentQueries: string[] = [];

      if (hasGeminiQueries && searchQueriesForSegments[idx]) {
        segmentQueries = searchQueriesForSegments[idx];
      } else {
        // Fallback: If user has custom terms, distribute them sequentially or cycle
        if (userTerms.length > 0) {
          const primaryTerm = userTerms[idx % userTerms.length];
          segmentQueries.push(primaryTerm);
          if (userTerms.length > 1) {
            segmentQueries.push(userTerms[(idx + 1) % userTerms.length]);
          }
        }

        // Advanced local parser to extract significant nouns/verbs from sentence (excluding common Spanish stop words)
        const commonWords = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o", "u", "con", "para", "por", "si", "no", "es", "son", "se", "su", "sus", "que", "como", "mas", "pero", "este", "esta", "estos", "estas"]);
        const words = sentence
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
          .split(/\s+/)
          .filter(w => w.length > 3 && !commonWords.has(w));

        if (words.length > 0) {
          segmentQueries.push(words[0]);
          if (words.length > 1) {
            segmentQueries.push(words[1]);
          }
        }

        if (segmentQueries.length === 0) {
          segmentQueries.push("cinematic", "scenic");
        }
      }

      // Ensure queries are cleaned, trimmed and unique
      segmentQueries = Array.from(new Set(segmentQueries.map(q => q.trim()).filter(Boolean)));

      return {
        id: `seg_${idx + 1}`,
        order: idx + 1,
        narration_text: sentence,
        start_sec: idx * clipDuration,
        end_sec: (idx + 1) * clipDuration,
        target_duration_sec: clipDuration,
        visual_goal: `Estilo visual representando: ${sentence}`,
        search_queries: segmentQueries
      };
    });

    p.shot_plan = {
      language: p.language || "es",
      topic: p.topic,
      script: p.script,
      total_duration_sec: segments.length * clipDuration,
      segments: segments,
      global_visual_style: req.body.global_visual_style || "cinematic",
      music_intent: {
        mood: "inspirational",
        energy: "mid",
        tempo: "slow",
        style: "acoustic"
      }
    };
    p.has_shot_plan = true;
    p.videos = [];
    p.combined_videos = [];
    p.updated_at = new Date().toISOString();
    projects.set(req.params.id, p);

    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, segment_count: segments.length }
    });
  }));

  const getPexelsApiKey = (): string | null => {
    if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY;
    if (process.env.PEXELS_KEY) return process.env.PEXELS_KEY;
    const keys = (globalConfig.settings as any)?.app?.pexels_api_keys || [];
    if (keys && keys.length > 0) return keys[0];
    return null;
  };

  app.post("/api/v1/projects/:id/media/search", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    const videoSource = req.body.video_source || p.params?.video_source || p.video_source || "pexels";
    
    // Explicitly persist the active parameters into the project DB
    if (!p.params) {
      p.params = {};
    }
    p.params.video_source = videoSource;
    p.video_source = videoSource;
    if (req.body.local_video_files !== undefined) {
      p.params.local_video_files = req.body.local_video_files;
    }
    projects.set(req.params.id, p);

    let selected: any[] = [];
    let candidates: any[] = [];

    if (videoSource === "local") {
      console.log(`[LocalVideo] Populating timeline media from local storage...`);
      const localFiles = p.params.local_video_files || [];
      console.log(`[LocalVideo] Selected files in configuration:`, localFiles);
      const files = fs.readdirSync(LOCAL_VIDEOS_DIR);
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
      const availableLocalFiles = files.filter(f => videoExtensions.includes(path.extname(f).toLowerCase()));

      const defaultLocalVideos = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
      let filteredAvailable = availableLocalFiles;
      const hasCustomFiles = availableLocalFiles.some(f => !defaultLocalVideos.includes(f));
      if (hasCustomFiles) {
        filteredAvailable = availableLocalFiles.filter(f => !defaultLocalVideos.includes(f));
      }

      const chosenFiles = (localFiles && localFiles.length > 0) ? localFiles : filteredAvailable;
      const finalChosen = chosenFiles.length > 0 ? chosenFiles : defaultLocalVideos;
      console.log(`[LocalVideo] Final chosen files list to cycle:`, finalChosen);

      const segments = p.shot_plan?.segments || [];
      for (let idx = 0; idx < segments.length; idx++) {
        const seg = segments[idx];
        const filename = finalChosen[idx % finalChosen.length];
        
        // Let's get the real duration of this local video to populate the metadata
        const fullDiskPath = path.join(LOCAL_VIDEOS_DIR, filename);
        let durationSec = 15;
        if (fs.existsSync(fullDiskPath)) {
          try {
            const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullDiskPath}"`);
            const d = parseFloat(durationStr.trim());
            if (!isNaN(d) && d > 0) {
              durationSec = d;
            }
          } catch (e) {
            console.warn(`[LocalVideo] Failed to get duration for ${filename} during search, defaulting to 15s`, e);
          }
        }

        const videoData = {
          id: `${seg.id}_selected`,
          provider: "local",
          source_url: `/storage/local_videos/${filename}`,
          download_url: `/storage/local_videos/${filename}`,
          local_path: `storage/local_videos/${filename}`,
          thumbnail_url: "/dist/assets/background.jpg",
          width: 1280,
          height: 720,
          duration_sec: durationSec,
          query: "local",
          title: filename,
          segment_id: seg.id
        };

        selected.push(videoData);
        candidates.push({
          ...videoData,
          id: `${seg.id}_cand_1`,
          score: 1.0,
          score_reasons: ["Matches local video selection"]
        });
      }
    } else {
      const apiKey = getPexelsApiKey();
      // Resolve orientation based on active project parameters
      const reqOrientation = req.body.orientation || (p.params?.video_aspect === "16:9" ? "landscape" : "portrait");
      const orientation = reqOrientation === "landscape" || reqOrientation === "portrait" || reqOrientation === "square" ? reqOrientation : "portrait";

      if (apiKey) {
        console.log(`[Pexels] API Key found! Searching Pexels online with orientation "${orientation}"...`);
        const usedVideoIds = new Set<string>();
        const segments = p.shot_plan?.segments || [];
        for (let idx = 0; idx < segments.length; idx++) {
          const seg = segments[idx];
          
          let results: any[] = [];
          let successfulQuery = "";
          const queries = seg.search_queries && seg.search_queries.length > 0 ? seg.search_queries : [p.topic || "nature"];

          console.log(`[Pexels] Segment ${seg.id} queries to try:`, queries);
          for (const q of queries) {
            results = await searchPexelsVideos(q, apiKey, orientation);
            if (results.length > 0) {
              successfulQuery = q;
              break;
            }
          }

          if (results.length > 0) {
            console.log(`[Pexels] Segment ${seg.id} search succeeded for query "${successfulQuery}" with ${results.length} results.`);
            candidates.push(...results.map((r, i) => ({
              ...r,
              id: `${seg.id}_cand_${i + 1}`,
              segment_id: seg.id,
              score: 1.0 - i * 0.05,
              score_reasons: [`Matches online search: ${successfulQuery}`]
            })));

            // Find first video result that has not been selected for any other segment yet
            const selectedVideo = pickUniqueClip(results, usedVideoIds)!;

            selected.push({
              ...selectedVideo,
              id: `${seg.id}_selected`,
              segment_id: seg.id
            });
          } else {
            console.log(`[Pexels] Segment ${seg.id} search failed for all queries. Falling back to sample video.`);
            const rotatedSamples = SAMPLE_VIDEOS.map((_, i) => SAMPLE_VIDEOS[(idx + i) % SAMPLE_VIDEOS.length]);
            const best = pickUniqueClip(rotatedSamples, usedVideoIds)!;

            selected.push({
              ...best,
              id: `${seg.id}_selected`,
              segment_id: seg.id
            });
          }
        }
      } else {
        console.log(`[Pexels] No API Key found, using local semantic matching against SAMPLE_VIDEOS...`);
        const usedVideoIds = new Set<string>();
        candidates = p.shot_plan?.segments?.flatMap((seg: any) => {
          return SAMPLE_VIDEOS.map((v, i) => ({
            ...v,
            id: `${seg.id}_cand_${i + 1}`,
            segment_id: seg.id,
            score: 0.9 - i * 0.1,
            score_reasons: ["Matches query: " + seg.search_queries.join(", ")]
          }));
        }) || [];

        selected = p.shot_plan?.segments?.map((seg: any, idx: number) => {
          const queryKeywords = seg.search_queries || [];
          const matches = SAMPLE_VIDEOS.filter(v => 
            queryKeywords.some((q: string) => v.query.toLowerCase().includes(q.toLowerCase()) || v.title.toLowerCase().includes(q.toLowerCase()))
          );
          
          let best = matches.find(m => !usedVideoIds.has(m.id || m.source_url)) || matches[0];
          if (!best) {
            best = SAMPLE_VIDEOS.find(v => !usedVideoIds.has(v.id || v.source_url)) || SAMPLE_VIDEOS[idx % SAMPLE_VIDEOS.length];
          }

          const chosenId = best.id || best.source_url;
          if (chosenId) {
            usedVideoIds.add(String(chosenId));
          }

          return {
            ...best,
            id: `${seg.id}_selected`,
            segment_id: seg.id
          };
        }) || [];
      }
    }

    p.media_candidates = candidates;
    p.selected_media = selected;
    p.has_selected_media = true;
    p.updated_at = new Date().toISOString();
    projects.set(req.params.id, p);

    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, selected_count: selected.length }
    });
  }));

  app.post("/api/v1/projects/:id/timeline/build", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    // Build audio items first to determine total duration
    const audioItems = (p.shot_plan?.segments || []).map((seg: any, idx: number) => {
      const startSec = seg.start_sec !== undefined ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== undefined ? seg.target_duration_sec : 5;
      return {
        id: `audio_${idx + 1}`,
        start_sec: startSec,
        duration_sec: durationSec,
        text: seg.narration_text,
        segment_id: seg.id,
        asset_url: p.narration_audio_path || null
      };
    });

    const totalDurationSec = audioItems.reduce((acc: number, item: any) => Math.max(acc, item.start_sec + item.duration_sec), 0) || 15;

    // Build timeline video tracks
    let videoItems = [];
    const isLocalSource = (p.params?.video_source === "local" || p.video_source === "local" || (p.selected_media && p.selected_media[0]?.provider === "local"));

    if (isLocalSource) {
      const uniqueFiles: any[] = [];
      const seen = new Set();
      const chosenLocalFiles = p.params?.local_video_files || [];
      console.log(`[Timeline] Building track. chosenLocalFiles:`, chosenLocalFiles, `selected_media count:`, p.selected_media?.length || 0);

      if (chosenLocalFiles.length > 0) {
        for (const filename of chosenLocalFiles) {
          const existingMed = (p.selected_media || []).find((m: any) => path.basename(m.source_url || m.asset_url || "") === filename);
          if (existingMed) {
            if (!seen.has(existingMed.source_url)) {
              seen.add(existingMed.source_url);
              // Ensure local_path is correctly set on existing media
              if (!existingMed.local_path) {
                existingMed.local_path = `storage/local_videos/${filename}`;
              }
              uniqueFiles.push(existingMed);
            }
          } else {
            const sourceUrl = `/storage/local_videos/${filename}`;
            if (!seen.has(sourceUrl)) {
              seen.add(sourceUrl);
              const fullDiskPath = path.join(LOCAL_VIDEOS_DIR, filename);
              let durationSec = 15;
              if (fs.existsSync(fullDiskPath)) {
                try {
                  const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullDiskPath}"`);
                  const d = parseFloat(durationStr.trim());
                  if (!isNaN(d) && d > 0) {
                    durationSec = d;
                  }
                } catch (e) {
                  console.warn(`[Timeline] Failed to get duration for ${filename} during build, defaulting to 15s`, e);
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
          const files = fs.readdirSync(LOCAL_VIDEOS_DIR);
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
          console.error("[Timeline] Failed to read fallback local videos:", e);
        }
      }

      // If there are custom files on disk, and the user did NOT explicitly select any local video files,
      // exclude default demo videos from fallback uniqueFiles
      const defaultLocalVideos = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
      try {
        const filesOnDisk = fs.readdirSync(LOCAL_VIDEOS_DIR);
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
        console.error("[Timeline] Failed to filter uniqueFiles against disk:", err);
      }

      console.log(`[Timeline] Building continuous local video track from ${uniqueFiles.length} unique local files for total duration ${totalDurationSec}s`);

      let currentStartSec = 0;
      let itemId = 1;
      videoItems = [];
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
    } else {
      const clipDuration = Number(p.params?.video_clip_duration) || Number(p.video_clip_duration) || 5;
      let itemId = 1;
      videoItems = [];

      const segments = p.shot_plan?.segments || [];
      console.log(`[Timeline] Building continuous non-local video track with complete asset uniqueness. Clip duration setting: ${clipDuration}s. Total segments: ${segments.length}. Total duration: ${totalDurationSec}s`);

      // Enforce complete asset uniqueness across the entire project
      const usedAssetKeys = new Set<string>();
      const getAssetKey = (media: any): string => {
        if (!media) return "";
        return String(media.download_url || media.source_url || media.asset_url || media.local_path || media.id || "");
      };

      let currentStartSec = 0;
      while (currentStartSec < totalDurationSec) {
        const remaining = totalDurationSec - currentStartSec;
        const usedDuration = Math.min(clipDuration, remaining);

        // Find the segment that covers the midpoint of this video item's time range
        const clipMidpoint = currentStartSec + (usedDuration / 2);
        const activeSeg = segments.find(s => {
          const sStart = s.start_sec !== undefined ? s.start_sec : 0;
          const sEnd = s.end_sec !== undefined ? s.end_sec : sStart + (s.target_duration_sec || 5);
          return clipMidpoint >= sStart && clipMidpoint <= sEnd;
        }) || segments[segments.length - 1];

        // 1. Get candidates for this active segment
        const segCandidates = (p.media_candidates || []).filter((c: any) => c.segment_id === activeSeg.id);
        
        // 2. Get primary selected media for this active segment
        const primaryMedia = (p.selected_media || []).find((m: any) => m.segment_id === activeSeg.id);

        let mediaToUse: any = null;

        // Priority A: Unused primary media for the active segment
        if (primaryMedia) {
          const key = getAssetKey(primaryMedia);
          if (key && !usedAssetKeys.has(key)) {
            mediaToUse = primaryMedia;
          }
        }

        // Priority B: An unused candidate from the current active segment
        if (!mediaToUse && segCandidates.length > 0) {
          for (const cand of segCandidates) {
            const key = getAssetKey(cand);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = cand;
              break;
            }
          }
        }

        // Priority C: An unused primary media from ANY segment in the project
        if (!mediaToUse) {
          for (const m of (p.selected_media || [])) {
            const key = getAssetKey(m);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = m;
              break;
            }
          }
        }

        // Priority D: An unused candidate from ANY other segment in the project
        if (!mediaToUse) {
          for (const cand of (p.media_candidates || [])) {
            const key = getAssetKey(cand);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = cand;
              break;
            }
          }
        }

        // Priority E: An unused video from SAMPLE_VIDEOS
        if (!mediaToUse) {
          for (const v of SAMPLE_VIDEOS) {
            const key = getAssetKey(v);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = v;
              break;
            }
          }
        }

        // Priority F: Full fallback (cycle if absolutely no unique assets remain)
        if (!mediaToUse) {
          mediaToUse = primaryMedia || segCandidates[0] || SAMPLE_VIDEOS[(activeSeg.order || 1) % SAMPLE_VIDEOS.length];
        }

        // Track that this asset is now in use
        const chosenKey = getAssetKey(mediaToUse);
        if (chosenKey) {
          usedAssetKeys.add(chosenKey);
        }

        // Fresh unique asset, start trimming from 0
        const trimStart = 0;

        videoItems.push({
          id: `item_${itemId}`,
          media_id: mediaToUse.id || `item_media_${itemId}`,
          local_path: mediaToUse.local_path,
          asset_url: mediaToUse.source_url || mediaToUse.asset_url,
          thumbnail_url: mediaToUse.thumbnail_url,
          source_url: mediaToUse.source_url || mediaToUse.asset_url,
          start_sec: currentStartSec,
          duration_sec: usedDuration,
          trim_start_sec: trimStart,
          trim_end_sec: trimStart + usedDuration,
          segment_id: activeSeg.id,
          provider: mediaToUse.provider || "pexels"
        });

        currentStartSec += usedDuration;
        itemId++;
      }
    }

    const subtitleItems: any[] = [];
    (p.shot_plan?.segments || []).forEach((seg: any, idx: number) => {
      const startSec = seg.start_sec !== undefined ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== undefined ? seg.target_duration_sec : 5;
      const splitCues = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_${idx + 1}`);
      subtitleItems.push(...splitCues);
    });

    p.tracks = [
      { id: "track_video", type: "video", name: "Video Track", items: videoItems },
      { id: "track_audio", type: "audio", name: "Audio Track", items: audioItems },
      { id: "track_subtitle", type: "subtitle", name: "Subtitle Track", items: subtitleItems }
    ];

    p.has_timeline = true;
    p.updated_at = new Date().toISOString();
    projects.set(req.params.id, p);

    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, track_count: p.tracks.length }
    });
  }));

  app.post("/api/v1/projects/:id/narration", wrap(async (req: any, res: any) => {
    const projectId = req.params.id;
    const p = projects.get(projectId);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    const voice_name = req.body.voice_name || "es-ES-AlvaroNeural-Male";
    const subtitle_enabled = req.body.subtitle_enabled !== false;
    const voice_rate = req.body.voice_rate !== undefined ? req.body.voice_rate : 1.0;
    const voice_volume = req.body.voice_volume !== undefined ? req.body.voice_volume : 1.0;

    // Resolve Google Translate TTS language code
    let tl = p.language || "es";
    const voiceNameLower = voice_name.toLowerCase();
    if (voiceNameLower.includes("en-") || voiceNameLower.includes("us-") || voiceNameLower.includes("guy") || voiceNameLower.includes("jenny") || voiceNameLower.includes("alex") || voiceNameLower.includes("anna") || voiceNameLower.includes("bella") || voiceNameLower.includes("benjamin") || voiceNameLower.includes("charles") || voiceNameLower.includes("claire") || voiceNameLower.includes("david") || voiceNameLower.includes("diana") || voiceNameLower.includes("milo") || voiceNameLower.includes("dean") || voiceNameLower.includes("chloe") || voiceNameLower.includes("mia") || voiceNameLower.includes("puck") || voiceNameLower.includes("charon") || voiceNameLower.includes("zephyr")) {
      tl = "en";
    } else if (voiceNameLower.includes("zh-") || voiceNameLower.includes("cn-") || voiceNameLower.includes("xiaoxiao") || voiceNameLower.includes("yunxi") || voiceNameLower.includes("冰糖") || voiceNameLower.includes("茉莉") || voiceNameLower.includes("苏打") || voiceNameLower.includes("白桦")) {
      tl = "zh-CN";
    } else if (voiceNameLower.includes("es-") || voiceNameLower.includes("mx-") || voiceNameLower.includes("alvaro") || voiceNameLower.includes("elvira") || voiceNameLower.includes("dalia") || voiceNameLower.includes("jorge")) {
      tl = "es";
    }

    // Ensure we have a project_folder_name
    if (!p.project_folder_name) {
      const themeFolder = sanitizeFolderName(p.params?.video_niche || p.topic || 'general');
      const folderName = `${sanitizeFolderName(p.topic || p.project_id || 'project')}_${getFormattedDateTime()}`;
      p.project_folder_name = `${themeFolder}/${folderName}`;
      projects.set(projectId, p);
    }

    const projectFolder = path.join(process.cwd(), "storage", "renders", p.project_folder_name);
    const cacheDir = path.join(projectFolder, "cache");
    const renderDir = projectFolder;
    await fs.promises.mkdir(cacheDir, { recursive: true });
    await fs.promises.mkdir(renderDir, { recursive: true });

    // Ensure we have planned segments
    let segments = p.shot_plan?.segments || [];
    if (segments.length === 0) {
      const sentences = (p.script || p.topic || "")
        .split(/[.!?]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);

      if (sentences.length === 0) {
        sentences.push("Esto es un video de prueba de generación.");
      }

      segments = sentences.map((sentence: string, idx: number) => ({
        id: `seg_${idx + 1}`,
        order: idx + 1,
        narration_text: sentence,
        search_queries: sentence.split(" ").slice(0, 2).map(w => w.replace(/[^a-zA-Z]/g, "")).filter(w => w.length > 2)
      }));

      p.shot_plan = p.shot_plan || {};
      p.shot_plan.segments = segments;
      p.has_shot_plan = true;
    }

    console.log(`[Narration] Synthesizing speech for ${segments.length} segments using language ${tl}...`);

    const localPaths: string[] = [];
    const wavPaths: string[] = [];
    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      const text = seg.narration_text || "Silencio";
      const destPath = path.join(cacheDir, `narration_chunk_${projectId}_${idx}.mp3`);
      const wavPath = path.join(cacheDir, `narration_chunk_${projectId}_${idx}.wav`);
      
      try {
        const audioBuffer = await synthesizeSpeech(voice_name, text, tl, voice_rate, voice_volume);
        await fs.promises.writeFile(destPath, audioBuffer);
        localPaths.push(destPath);
        
        // Convert MP3 to WAV for precise timing and gapless concatenation
        await executeCommand(`ffmpeg -y -i "${destPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${wavPath}"`);
        wavPaths.push(wavPath);
      } catch (err) {
        console.error(`[Narration] Failed to synthesize chunk ${idx}:`, err);
        const fallbackPath = path.join(cacheDir, `narration_chunk_${projectId}_${idx}_fallback.mp3`);
        await executeCommand(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 3 "${fallbackPath}"`);
        localPaths.push(fallbackPath);
        
        await executeCommand(`ffmpeg -y -i "${fallbackPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${wavPath}"`);
        wavPaths.push(wavPath);
      }
    }

    const concatListPath = path.join(cacheDir, `concat_audio_${projectId}.txt`);
    const concatContent = wavPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
    await fs.promises.writeFile(concatListPath, concatContent, "utf8");

    const finalWavPath = path.join(cacheDir, `narration_${projectId}_temp.wav`);
    console.log(`[Narration] Merging ${wavPaths.length} WAV chunks into: ${finalWavPath}`);
    await executeCommand(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -acodec pcm_s16le "${finalWavPath}"`);

    const finalAudioPath = path.join(renderDir, `narration_${projectId}.mp3`);
    console.log(`[Narration] Converting final WAV to MP3: ${finalAudioPath}`);
    await executeCommand(`ffmpeg -y -i "${finalWavPath}" -codec:a libmp3lame -b:a 192k "${finalAudioPath}"`);

    let currentStartSec = 0;
    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      const chunkPath = wavPaths[idx]; // Use the WAV path to get a sample-accurate duration
      let duration = 5;
      try {
        const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${chunkPath}"`);
        const val = parseFloat(durationStr.trim());
        if (!isNaN(val) && val > 0) {
          duration = val;
        }
      } catch (err) {
        console.error(`[Narration] Failed to probe duration for chunk ${idx}:`, err);
      }

      seg.start_sec = currentStartSec;
      seg.target_duration_sec = duration;
      seg.end_sec = currentStartSec + duration;
      currentStartSec += duration;
    }

    p.shot_plan.segments = segments;
    p.narration_audio_path = `/storage/renders/${p.project_folder_name}/narration_${projectId}.mp3`;
    p.updated_at = new Date().toISOString();

    let subtitlePath: string | null = null;
    if (subtitle_enabled) {
      const splitCuesForSrt: any[] = [];
      segments.forEach((seg: any, idx: number) => {
        const startSec = seg.start_sec !== undefined ? seg.start_sec : idx * 5;
        const durationSec = seg.target_duration_sec !== undefined ? seg.target_duration_sec : 5;
        const splitItems = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_${idx + 1}`);
        splitCuesForSrt.push(...splitItems);
      });
      const srtContent = generateSrt(splitCuesForSrt);
      const srtPath = path.join(renderDir, `subtitles_${projectId}.srt`);
      await fs.promises.writeFile(srtPath, srtContent, "utf8");
      subtitlePath = `/storage/renders/${p.project_folder_name}/subtitles_${projectId}.srt`;
      p.subtitle_path = subtitlePath;
    }

    const audioItems = (p.shot_plan?.segments || []).map((seg: any, idx: number) => {
      const startSec = seg.start_sec !== undefined ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== undefined ? seg.target_duration_sec : 5;
      return {
        id: `audio_${idx + 1}`,
        start_sec: startSec,
        duration_sec: durationSec,
        text: seg.narration_text,
        segment_id: seg.id,
        asset_url: p.narration_audio_path || null
      };
    });

    const subtitleItems: any[] = [];
    (p.shot_plan?.segments || []).forEach((seg: any, idx: number) => {
      const startSec = seg.start_sec !== undefined ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== undefined ? seg.target_duration_sec : 5;
      const splitCues = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_${idx + 1}`);
      subtitleItems.push(...splitCues);
    });

    if (p.tracks) {
      p.tracks = p.tracks.filter((t: any) => t.type !== "audio" && t.type !== "subtitle");
      p.tracks.push({ id: "track_audio", type: "audio", name: "Audio Track", items: audioItems });
      p.tracks.push({ id: "track_subtitle", type: "subtitle", name: "Subtitle Track", items: subtitleItems });
    }

    projects.set(projectId, p);

    res.json({
      status: 200,
      message: "ok",
      data: {
        project_id: projectId,
        narration_audio_path: p.narration_audio_path,
        audio_duration_sec: currentStartSec,
        subtitle_path: subtitlePath
      }
    });
  }));

  app.post("/api/v1/projects/:id/timeline/commands", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    const commands = req.body.commands || [];
    if (!p.tracks) {
      p.tracks = [];
    }

    for (const cmd of commands) {
      const track = p.tracks.find((t: any) => t.id === cmd.track_id);
      if (!track) continue;

      if (cmd.type === "move") {
        const itemIndex = track.items.findIndex((item: any) => item.id === cmd.item_id);
        if (itemIndex !== -1) {
          if (cmd.new_start_sec < 0) {
            // Delete/remove the item from the track!
            track.items.splice(itemIndex, 1);
          } else {
            track.items[itemIndex].start_sec = cmd.new_start_sec;
          }
        }
      } else if (cmd.type === "trim") {
        const item = track.items.find((item: any) => item.id === cmd.item_id);
        if (item) {
          if (cmd.trim_start_sec !== undefined) item.trim_start_sec = cmd.trim_start_sec;
          if (cmd.trim_end_sec !== undefined) item.trim_end_sec = cmd.trim_end_sec;
        }
      } else if (cmd.type === "set_timing") {
        const item = track.items.find((item: any) => item.id === cmd.item_id);
        if (item) {
          if (cmd.duration_sec === 0) {
            const itemIndex = track.items.indexOf(item);
            if (itemIndex !== -1) {
              track.items.splice(itemIndex, 1);
            }
          } else if (cmd.duration_sec !== undefined) {
            item.duration_sec = cmd.duration_sec;
          }
        }
      } else if (cmd.type === "duplicate") {
        const itemIndex = track.items.findIndex((item: any) => item.id === cmd.item_id);
        if (itemIndex !== -1) {
          const originalItem = track.items[itemIndex];
          const newItemId = cmd.new_item_id || `item_dup_${Math.random().toString(36).substring(2, 6)}`;
          const duplicatedItem = {
            ...originalItem,
            id: newItemId,
            start_sec: originalItem.start_sec + originalItem.duration_sec,
          };
          // Insert right after originalItem
          track.items.splice(itemIndex + 1, 0, duplicatedItem);

          // Re-calculate start_sec for all items after the duplicated one
          let accStart = originalItem.start_sec + originalItem.duration_sec;
          for (let i = itemIndex + 1; i < track.items.length; i++) {
            track.items[i].start_sec = accStart;
            accStart += track.items[i].duration_sec;
          }
        }
      }
    }

    // Sort items by start_sec to ensure they are always in order
    for (const track of p.tracks) {
      if (Array.isArray(track.items)) {
        track.items.sort((a: any, b: any) => a.start_sec - b.start_sec);
      }
    }

    p.updated_at = new Date().toISOString();
    projects.set(req.params.id, p);

    res.json({
      status: 200,
      message: "ok",
      data: { project_id: req.params.id, applied: commands.length, valid: true }
    });
  }));

  app.post("/api/v1/projects/:id/timeline/validate", wrap(async (req: any, res: any) => {
    res.json({ status: 200, message: "ok", data: { project_id: req.params.id, valid: true } });
  }));

  app.post("/api/v1/projects/:id/music/select", wrap(async (req: any, res: any) => {
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

  app.get("/api/v1/projects/:id/music", wrap(async (req: any, res: any) => {
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

  const { runRealRender } = createRenderer({
    projects,
    tasks,
    logTask,
    localVideosDir: LOCAL_VIDEOS_DIR,
    bgmFiles: BGM_FILES,
    sanitizeFolderName,
    getFormattedDateTime,
  });

  app.post("/api/v1/projects/:id/render", wrap(async (req: any, res: any) => {
    const renderTaskId = "render_task_" + req.params.id;
    tasks.set(renderTaskId, {
      state: 4, // TASK_STATE_PROCESSING
      progress: 0,
      output_path: null,
      error: null,
      logs: []
    });

    logTask(renderTaskId, "INFO", "SYSTEM", `Initializing video generation task ${renderTaskId}...`);
    logTask(renderTaskId, "INFO", "VALIDATION", "Verifying request payload parameters...");

    runRealRender(req.params.id, renderTaskId).catch(err => {
      console.error(`[Renderer] Background render failed for project ${req.params.id}:`, err);
    });

    res.json({ status: 200, message: "ok", data: { project_id: req.params.id, state: 4 } });
  }));

  app.get("/api/v1/projects/:id/render", wrap(async (req: any, res: any) => {
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

  app.get("/api/v1/projects/:id/assets", wrap(async (req: any, res: any) => {
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

  app.get("/api/v1/projects/:id/assets/*", wrap(async (req: any, res: any) => {
    // Redirect asset fetch to online resource
    res.redirect("https://videos.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4");
  }));

  // Serve local videos from whatever folder is active (either root local_videos or storage/local_videos)
  app.use("/storage/local_videos", express.static(LOCAL_VIDEOS_DIR));

  // Serve storage directory statically
  app.use("/storage", express.static(path.join(process.cwd(), "storage")));

  // TikTok Domain/URL Verification Endpoint
  app.get("/:filename", (req: any, res: any, next: any) => {
    const filename = req.params.filename;
    let verificationFilename = globalConfig.settings?.tiktok?.verification_filename;
    let verificationContent = globalConfig.settings?.tiktok?.verification_content;

    // Load from disk directly as a fallback/guarantee to make it 100% robust
    const tkCreds = loadTiktokChannels();
    if (tkCreds.verification_filename) {
      verificationFilename = tkCreds.verification_filename;
    }
    if (tkCreds.verification_content) {
      verificationContent = tkCreds.verification_content;
    }

    if (verificationFilename && filename === verificationFilename) {
      return res.type("text/plain").send(verificationContent);
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handler middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Server Error]", err);
    res.status(500).json({ status: 500, message: err.message || "Internal Server Error", data: null });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();
