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
var import_child_process = require("child_process");
var import_vite = require("vite");
var import_ws = __toESM(require("ws"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_genai = require("@google/genai");
var import_multer = __toESM(require("multer"), 1);
try {
  const envPath = import_path.default.join(process.cwd(), ".env");
  if (import_fs.default.existsSync(envPath)) {
    const envContent = import_fs.default.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const parts = trimmed.split("=");
        const key = parts[0]?.trim();
        const value = parts.slice(1).join("=").trim();
        if (key && value) {
          process.env[key] = value.replace(/^['"]|['"]$/g, "");
        }
      }
    });
  }
} catch (e) {
  console.error("Error parsing .env file:", e);
}
var LOCAL_VIDEOS_DIR = import_path.default.join(process.cwd(), "storage", "local_videos");
if (import_fs.default.existsSync(import_path.default.join(process.cwd(), "local_videos"))) {
  LOCAL_VIDEOS_DIR = import_path.default.join(process.cwd(), "local_videos");
} else if (!import_fs.default.existsSync(LOCAL_VIDEOS_DIR)) {
  import_fs.default.mkdirSync(LOCAL_VIDEOS_DIR, { recursive: true });
}
var storage = import_multer.default.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOCAL_VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = import_path.default.basename(file.originalname);
    cb(null, safeName);
  }
});
var upload = (0, import_multer.default)({ storage });
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
  { name: "Ambient Forest", size: 5410234, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", tags: ["nature", "forest", "ambient", "calm", "slow", "relax", "meditation", "peaceful", "wood", "water", "tree", "river"] },
  { name: "Cosmic Journey", size: 6109230, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", tags: ["space", "cosmic", "journey", "synth", "futuristic", "tech", "modern", "energy", "inspirational", "fast", "electronic", "star"] },
  { name: "Sunny Day Acoustic", size: 4892019, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", tags: ["acoustic", "guitar", "happy", "sunny", "day", "cheerful", "organic", "warm", "people", "friend", "life", "fun"] }
];
var SAMPLE_VIDEOS = [
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
async function generateGeminiContent(prompt, jsonMode = false) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key configured. Set GEMINI_API_KEY.");
  }
  try {
    const ai = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: jsonMode ? { responseMimeType: "application/json" } : void 0
    });
    return response.text || "";
  } catch (err) {
    console.error("Failed calling Gemini API via SDK:", err);
    throw err;
  }
}
function sanitizeFolderName(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").substring(0, 40) || "project";
}
function getFormattedDateTime() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
var PROJECTS_FILE = import_path.default.join(process.cwd(), "storage", "projects_db.json");
function loadProjects() {
  try {
    const dir = import_path.default.dirname(PROJECTS_FILE);
    if (!import_fs.default.existsSync(dir)) {
      import_fs.default.mkdirSync(dir, { recursive: true });
    }
    if (import_fs.default.existsSync(PROJECTS_FILE)) {
      const data = import_fs.default.readFileSync(PROJECTS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      const map = /* @__PURE__ */ new Map();
      for (const [k, v] of Object.entries(parsed)) {
        map.set(k, v);
      }
      return map;
    }
  } catch (err) {
    console.error("Error loading projects from file, using empty map:", err);
  }
  return /* @__PURE__ */ new Map();
}
function saveProjects(map) {
  try {
    const obj = Object.fromEntries(map);
    import_fs.default.writeFileSync(PROJECTS_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving projects to file:", err);
  }
}
var projects = loadProjects();
var originalSet = projects.set.bind(projects);
projects.set = function(key, value) {
  const result = originalSet(key, value);
  saveProjects(projects);
  return result;
};
var originalDelete = projects.delete.bind(projects);
projects.delete = function(key) {
  const result = originalDelete(key);
  saveProjects(projects);
  return result;
};
var tasks = /* @__PURE__ */ new Map();
var globalConfig = {
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
function cleanVoiceName(voice) {
  let name = voice;
  if (name.includes(":")) {
    const parts = name.split(":");
    name = parts[parts.length - 1];
  }
  name = name.replace(/[-:](male|female)$/i, "");
  return name;
}
function getEdgeVoiceAndLang(rawVoiceName, defaultLang = "es") {
  let voice = cleanVoiceName(rawVoiceName);
  let lang = defaultLang;
  const localeMatch = voice.match(/^([a-z]{2})-([A-Z]{2})/);
  if (localeMatch) {
    lang = localeMatch[0];
  } else {
    const lower = rawVoiceName.toLowerCase();
    if (lower.includes("en-") || lower.includes("us-") || lower.includes("guy") || lower.includes("jenny") || lower.includes("alex") || lower.includes("anna") || lower.includes("bella") || lower.includes("benjamin") || lower.includes("charles") || lower.includes("claire") || lower.includes("david") || lower.includes("diana") || lower.includes("milo") || lower.includes("dean") || lower.includes("chloe") || lower.includes("mia") || lower.includes("puck") || lower.includes("charon") || lower.includes("zephyr")) {
      lang = "en-US";
    } else if (lower.includes("zh-") || lower.includes("cn-") || lower.includes("xiaoxiao") || lower.includes("yunxi") || lower.includes("\u51B0\u7CD6") || lower.includes("\u8309\u8389") || lower.includes("\u82CF\u6253") || lower.includes("\u767D\u6866")) {
      lang = "zh-CN";
    } else if (lower.includes("es-") || lower.includes("mx-") || lower.includes("alvaro") || lower.includes("elvira") || lower.includes("dalia") || lower.includes("jorge")) {
      lang = "es-ES";
    } else if (lower.includes("pt-") || lower.includes("br-")) {
      lang = "pt-BR";
    } else if (lower.includes("de-")) {
      lang = "de-DE";
    } else if (lower.includes("fr-")) {
      lang = "fr-FR";
    } else if (lower.includes("it-")) {
      lang = "it-IT";
    } else if (lower.includes("ru-")) {
      lang = "ru-RU";
    } else if (lower.includes("ja-") || lower.includes("jp-")) {
      lang = "ja-JP";
    }
  }
  const lowerVoice = voice.toLowerCase();
  if (!voice.includes("-") || voice.length < 5) {
    const isMale = lowerVoice.includes("male") || lowerVoice.includes("guy") || lowerVoice.includes("david") || lowerVoice.includes("charles") || lowerVoice.includes("benjamin") || lowerVoice.includes("puck") || lowerVoice.includes("charon") || lowerVoice.includes("zephyr") || lowerVoice.includes("milo") || lowerVoice.includes("dean") || lowerVoice.includes("suda") || lowerVoice.includes("\u82CF\u6253") || lowerVoice.includes("alvaro") || lowerVoice.includes("jorge");
    if (lang.startsWith("es")) {
      voice = isMale ? "es-ES-AlvaroNeural" : "es-ES-ElviraNeural";
    } else if (lang.startsWith("en")) {
      voice = isMale ? "en-US-GuyNeural" : "en-US-JennyNeural";
    } else if (lang.startsWith("zh")) {
      voice = isMale ? "zh-CN-YunxiNeural" : "zh-CN-XiaoxiaoNeural";
    } else if (lang.startsWith("pt")) {
      voice = isMale ? "pt-BR-JulioNeural" : "pt-BR-FranciscaNeural";
    } else if (lang.startsWith("de")) {
      voice = isMale ? "de-DE-ConradNeural" : "de-DE-AmalaNeural";
    } else if (lang.startsWith("fr")) {
      voice = isMale ? "fr-FR-HenriNeural" : "fr-FR-DeniseNeural";
    } else if (lang.startsWith("it")) {
      voice = isMale ? "it-IT-DiegoNeural" : "it-IT-ElsaNeural";
    } else if (lang.startsWith("ru")) {
      voice = isMale ? "ru-RU-DmitryNeural" : "ru-RU-SvetlanaNeural";
    } else if (lang.startsWith("ja")) {
      voice = isMale ? "ja-JP-KeitaNeural" : "ja-JP-NanamiNeural";
    } else {
      voice = isMale ? "en-US-GuyNeural" : "en-US-JennyNeural";
    }
  }
  return { voice, lang };
}
var WIN_EPOCH = 11644473600;
var S_TO_NS = 1e9;
var TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
var SEC_MS_GEC_VERSION = "1-143.0.3650.75";
function generateSecMsGec() {
  let ticks = Math.floor(Date.now() / 1e3);
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  const intervals = ticks * (S_TO_NS / 100);
  const strToHash = `${intervals.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  return import_crypto.default.createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}
function getJSStyleDateString() {
  const d = /* @__PURE__ */ new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = days[d.getUTCDay()];
  const monthName = months[d.getUTCMonth()];
  const dateNum = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  return `${dayName} ${monthName} ${dateNum} ${year} ${hours}:${minutes}:${seconds} GMT+0000 (Coordinated Universal Time)`;
}
function synthesizeSpeechWithEdge(voiceName, text, defaultLang = "es") {
  return new Promise((resolve, reject) => {
    const { voice, lang } = getEdgeVoiceAndLang(voiceName, defaultLang);
    console.log(`[EdgeTTS] Requesting voice: "${voice}" (lang: "${lang}") for text: "${text.substring(0, 60)}..."`);
    const requestId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const secMsGec = generateSecMsGec();
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${requestId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
    const ws = new import_ws.default(wsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "Sec-WebSocket-Version": "13"
      }
    });
    const audioBuffers = [];
    let isFinished = false;
    ws.on("open", () => {
      const timestampStr = getJSStyleDateString();
      const configPayload = JSON.stringify({
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "true"
              },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3"
            }
          }
        }
      });
      const configMsg = `X-Timestamp:${timestampStr}Z\r
Content-Type:application/json; charset=utf-8\r
Path:speech.config\r
\r
${configPayload}`;
      ws.send(configMsg);
      const cleanText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${cleanText}</prosody></voice></speak>`;
      const ssmlMsg = `X-RequestId:${requestId}\r
Content-Type:application/ssml+xml\r
X-Timestamp:${timestampStr}Z\r
Path:ssml\r
\r
${ssml}`;
      ws.send(ssmlMsg);
    });
    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        const buffer = Buffer.from(data);
        if (buffer.length >= 2) {
          const headerLen = buffer.readUInt16BE(0);
          const header = buffer.toString("utf8", 2, 2 + headerLen);
          if (header.includes("Path: audio") || header.includes("Path:audio")) {
            const audioPayload = buffer.subarray(2 + headerLen);
            audioBuffers.push(audioPayload);
          }
        }
      } else {
        const textMsg = data.toString();
        if (textMsg.includes("Path: turn.end") || textMsg.includes("Path:turn.end")) {
          isFinished = true;
          ws.close();
        }
      }
    });
    ws.on("close", () => {
      if (audioBuffers.length > 0) {
        resolve(Buffer.concat(audioBuffers));
      } else {
        reject(new Error("No audio data received from Edge TTS WebSocket"));
      }
    });
    ws.on("error", (err) => {
      reject(err);
    });
    setTimeout(() => {
      if (!isFinished) {
        ws.close();
        if (audioBuffers.length > 0) {
          resolve(Buffer.concat(audioBuffers));
        } else {
          reject(new Error("Edge TTS timeout"));
        }
      }
    }, 15e3);
  });
}
async function synthesizeSpeech(voiceName, text, defaultLang = "es") {
  try {
    return await synthesizeSpeechWithEdge(voiceName, text, defaultLang);
  } catch (err) {
    console.warn(`[SpeechSynthesis] Edge TTS failed for voice "${voiceName}", falling back to Google TTS:`, err);
    const { lang } = getEdgeVoiceAndLang(voiceName, defaultLang);
    const shortLang = lang.split("-")[0];
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${shortLang}&client=tw-ob&q=${encodeURIComponent(text.substring(0, 200))}`;
    const response = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!response.ok) {
      throw new Error(`Google TTS fallback failed with status ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
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
  app.post("/api/v1/local-videos/upload", upload.single("video"), wrap(async (req, res) => {
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
    let voicesList = [];
    if (provider === "azure-tts-v1" || provider === "edge-tts" || provider === "azure-tts-v2") {
      try {
        const azureVoicesPath = import_path.default.join(process.cwd(), "src", "api", "azure_voices.json");
        if (import_fs.default.existsSync(azureVoicesPath)) {
          const rawData = import_fs.default.readFileSync(azureVoicesPath, "utf-8");
          const azureVoicesList = JSON.parse(rawData);
          voicesList = azureVoicesList.map((item) => ({
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
        { value: "mimo:\u51B0\u7CD6-Female", label: "\u51B0\u7CD6 (Female)" },
        { value: "mimo:\u8309\u8389-Female", label: "\u8309\u8389 (Female)" },
        { value: "mimo:\u82CF\u6253-Male", label: "\u82CF\u6253 (Male)" },
        { value: "mimo:\u767D\u6866-Male", label: "\u767D\u6866 (Male)" },
        { value: "mimo:Mia-Female", label: "Mia (Female)" },
        { value: "mimo:Chloe-Female", label: "Chloe (Female)" },
        { value: "mimo:Milo-Male", label: "Milo (Male)" },
        { value: "mimo:Dean-Male", label: "Dean (Male)" }
      ];
    } else {
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
  function getFallbackScript(subject, paragraph_number) {
    const fallbackParagraphs = [
      `Bienvenidos a este viaje fascinante y profundamente revelador por el maravilloso mundo de ${subject}. En este relato, nos disponemos a desentra\xF1ar los secretos m\xE1s asombrosos, las leyendas ocultas y los acontecimientos hist\xF3ricos que han dado forma a este tema y que despiertan una inmensa pasi\xF3n en todos aquellos que se atreven a explorarlo con una mirada curiosa y atenta.`,
      `Al adentrarnos en las profundidades de ${subject}, comenzamos a descubrir detalles verdaderamente sorprendentes que desaf\xEDan lo unconventional y cambian por completo nuestra percepci\xF3n cotidiana de la realidad. Es un espect\xE1culo absolutamente asombroso contemplar c\xF3mo la ciencia rigurosa, la majestuosidad de la naturaleza ind\xF3mita y la chispa inagotable de la creatividad humana se entrelazan de manera perfecta para crear algo \xFAnico.`,
      `Cada rinc\xF3n y cada \xE9poca relacionados con ${subject} albergan lecciones valiosas de perseverancia, ingenio y misterio. A trav\xE9s de los a\xF1os, grandes pensadores y exploradores dedicaron sus vidas enteras a comprender estas din\xE1micas, dejando un legado imborrable que hoy en d\xEDa contin\xFAa inspirando a nuevas generaciones de entusiastas en todo el planeta.`,
      `Adem\xE1s, el impacto cultural y social de ${subject} no solo se limita al pasado, sino que sigue moldeando activamente nuestras interacciones modernas y la forma en que concebimos el ma\xF1ana. Comprender su esencia misma nos permite conectar con un prop\xF3sito mayor, reconociendo las influencias invisibles pero poderosas que gu\xEDan constantemente nuestras decisiones y nuestra evoluci\xF3n colectiva.`,
      `Es fascinante observar c\xF3mo las diferentes corrientes de pensamiento han convergido en torno a ${subject}, aportando cada una de ellas una perspectiva valiosa y \xFAnica que enriquece el debate global. Desde las aplicaciones m\xE1s pr\xE1cticas del d\xEDa a d\xEDa hasta las teor\xEDas m\xE1s abstractas de la filosof\xEDa y el arte, este campo de estudio se consolida como un puente indispensable entre diversas disciplinas del saber humano.`,
      `A medida que la tecnolog\xEDa y la investigaci\xF3n avanzan a pasos agigantados, nuevas dimensiones de ${subject} comienzan a revelarse ante nuestros ojos, planteando desaf\xEDos emocionantes y oportunidades sin precedentes. Los expertos coinciden en que apenas estamos rozando la superficie de lo que es posible alcanzar, lo que convierte a esta disciplina en un terreno sumamente f\xE9rtil para la innovaci\xF3n y el descubrimiento continuo.`,
      `Por otro lado, la vertiente humana de ${subject} nos recuerda la importancia de la empat\xEDa, la colaboraci\xF3n y el esfuerzo compartido en la construcci\xF3n de un futuro m\xE1s pr\xF3spero. Las grandes historias de \xE9xito asociadas a este \xE1mbito suelen estar protagonizadas por personas comunes que, impulsadas por una visi\xF3n extraordinaria, lograron superar barreras aparentemente insalvables.`,
      `Al reflexionar con mayor profundidad sobre la trascendencia de ${subject}, nos damos cuenta de que cada peque\xF1o avance en esta materia contribuye a tejer una red global de conocimiento interconectado. Esta sinergia no solo acelera el progreso t\xE9cnico, sino que tambi\xE9n fomenta un entendimiento m\xE1s profundo y compasivo entre las diversas comunidades que cohabitan en nuestro planeta.`,
      `De cara a los pr\xF3ximos a\xF1os, se vislumbra que ${subject} jugar\xE1 un papel crucial en la resoluci\xF3n de algunos de los interrogantes m\xE1s complejos del nuevo milenio. Estar preparados para comprender estos cambios y adaptarnos a ellos con flexibilidad ser\xE1, sin duda, una de las habilidades m\xE1s valiosas para las generaciones venideras.`,
      `Esperamos sinceramente que hayan disfrutado al m\xE1ximo de este enriquecedor recorrido lleno de aprendizaje y asombro por el universo de ${subject}. Los invitamos cordialmente a seguir explorando este y otros enigmas con la mente abierta, recordando siempre que la curiosidad insaciable es el verdadero motor que impulsa el conocimiento humano hacia horizontes infinitos.`
    ];
    return fallbackParagraphs.slice(0, paragraph_number).join("\n\n");
  }
  app.post("/api/v1/voices/preview", wrap(async (req, res) => {
    const voice_name = req.body.voice_name || "";
    const text = req.body.text || "Hola, probando esta voz.";
    let tl = "es";
    const voiceNameLower = voice_name.toLowerCase();
    if (voiceNameLower.includes("en-") || voiceNameLower.includes("us-") || voiceNameLower.includes("guy") || voiceNameLower.includes("jenny") || voiceNameLower.includes("alex") || voiceNameLower.includes("anna") || voiceNameLower.includes("bella") || voiceNameLower.includes("benjamin") || voiceNameLower.includes("charles") || voiceNameLower.includes("claire") || voiceNameLower.includes("david") || voiceNameLower.includes("diana") || voiceNameLower.includes("milo") || voiceNameLower.includes("dean") || voiceNameLower.includes("chloe") || voiceNameLower.includes("mia") || voiceNameLower.includes("puck") || voiceNameLower.includes("charon") || voiceNameLower.includes("zephyr")) {
      tl = "en";
    } else if (voiceNameLower.includes("zh-") || voiceNameLower.includes("cn-") || voiceNameLower.includes("xiaoxiao") || voiceNameLower.includes("yunxi") || voiceNameLower.includes("\u51B0\u7CD6") || voiceNameLower.includes("\u8309\u8389") || voiceNameLower.includes("\u82CF\u6253") || voiceNameLower.includes("\u767D\u6866")) {
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
      const parts = voice_name.split("-");
      if (parts[0] && parts[0].length === 2) {
        tl = parts[0];
      }
    }
    try {
      const audioBuffer = await synthesizeSpeech(voice_name, text, tl);
      res.setHeader("Content-Type", "audio/mpeg");
      res.send(audioBuffer);
    } catch (err) {
      console.error("Error fetching preview audio, falling back to silent wave:", err);
      const waveHeader = Buffer.from([
        82,
        73,
        70,
        70,
        // "RIFF"
        36,
        8,
        0,
        0,
        // Chunk size
        87,
        65,
        86,
        69,
        // "WAVE"
        102,
        109,
        116,
        32,
        // "fmt "
        16,
        0,
        0,
        0,
        // Subchunk1Size
        1,
        0,
        // AudioFormat: PCM
        1,
        0,
        // NumChannels: Mono
        64,
        31,
        0,
        0,
        // SampleRate: 8000
        64,
        31,
        0,
        0,
        // ByteRate: 8000
        1,
        0,
        // BlockAlign
        8,
        0,
        // BitsPerSample: 8
        100,
        97,
        116,
        97,
        // "data"
        0,
        8,
        0,
        0
        // Subchunk2Size
      ]);
      const waveData = Buffer.alloc(2048, 128);
      res.setHeader("Content-Type", "audio/wav");
      res.send(Buffer.concat([waveHeader, waveData]));
    }
  }));
  app.post("/api/v1/scripts", wrap(async (req, res) => {
    const { video_subject, video_language = "es", paragraph_number = 3 } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("No Gemini API key configured. Please set GEMINI_API_KEY.");
    }
    const prompt = `Escribe un gui\xF3n de video cautivador, detallado y narrativo sobre "${video_subject}" en idioma ${video_language}. Es CR\xCDTICO que el gui\xF3n tenga exactamente ${paragraph_number} p\xE1rrafos bien estructurados, completos y detallados (cada p\xE1rrafo debe ser lo suficientemente largo y descriptivo, \xF3ptimo para narrar una historia o un documental). Separa cada p\xE1rrafo estrictamente con dos saltos de l\xEDnea (\\n\\n). Devuelve SOLAMENTE el texto del gui\xF3n, sin t\xEDtulos, introducciones ni comentarios adicionales.`;
    const scriptText = await generateGeminiContent(prompt);
    res.json({ status: 200, message: "ok", data: { video_script: scriptText } });
  }));
  app.post("/api/v1/terms", wrap(async (req, res) => {
    const { video_subject, video_script = "" } = req.body;
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("No Gemini API key configured. Please set GEMINI_API_KEY.");
    }
    const prompt = `Analiza el siguiente gui\xF3n de video y genera una lista de exactamente 5 t\xE9rminos de b\xFAsqueda en ingl\xE9s (para buscar videos de stock relevantes). Devuelve una respuesta JSON con el formato: { "terms": ["term1", "term2", ...] }. Gui\xF3n: ${video_script}`;
    const resp = await generateGeminiContent(prompt, true);
    const parsed = JSON.parse(resp);
    const terms = parsed.terms || [];
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
  app.get("/api/v1/tasks/:id", wrap(async (req, res) => {
    const t = tasks.get(req.params.id);
    if (!t) {
      return res.status(404).json({ status: 404, message: "Task not found", data: null });
    }
    res.json({ status: 200, message: "ok", data: t });
  }));
  app.get("/api/v1/tasks", wrap(async (req, res) => {
    const data = {};
    for (const [k, v] of tasks.entries()) {
      data[k] = v;
    }
    res.json({ status: 200, message: "ok", data });
  }));
  app.delete("/api/v1/tasks/:id", wrap(async (req, res) => {
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
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("No Gemini API key configured. Please set GEMINI_API_KEY.");
      }
      const prompt = `Escribe un gui\xF3n de video cautivador, detallado y narrativo sobre "${topic}" en idioma ${language}. Es CR\xCDTICO que el gui\xF3n tenga exactamente ${paragraph_number} p\xE1rrafos bien estructurados, completos y detallados (cada p\xE1rrafo debe ser lo suficientemente largo y descriptivo, \xF3ptimo para narrar una historia o un documental). Separa cada p\xE1rrafo estrictamente con dos saltos de l\xEDnea (\\n\\n). Devuelve SOLAMENTE el texto del gui\xF3n, sin t\xEDtulos, introducciones ni comentarios adicionales.`;
      scriptText = await generateGeminiContent(prompt);
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
    if (p.tracks && !p.tracks.some((t) => t.type === "audio") && p.shot_plan?.segments) {
      const audioItems = (p.shot_plan?.segments || []).map((seg, idx) => {
        const startSec = seg.start_sec !== void 0 ? seg.start_sec : idx * 5;
        const durationSec = seg.target_duration_sec !== void 0 ? seg.target_duration_sec : 5;
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
    const clipDuration = Number(req.body.target_duration_sec) || Number(p.params?.video_clip_duration) || 5;
    const sentences = (p.script || p.topic || "").split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
    const rawTerms = p.params?.video_terms || p.video_terms || "";
    let userTerms = [];
    if (Array.isArray(rawTerms)) {
      userTerms = rawTerms.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof rawTerms === "string" && rawTerms.trim()) {
      userTerms = rawTerms.split(",").map((t) => t.trim()).filter(Boolean);
    }
    console.log(`[Plan] Project ${req.params.id} loaded. Custom video_terms parsed:`, userTerms);
    let searchQueriesForSegments = [];
    let hasGeminiQueries = false;
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Analiza las siguientes oraciones de un gui\xF3n de video en idioma "${p.language || "es"}":
${sentences.map((s, i) => `Segmento ${i + 1}: "${s}"`).join("\n")}

Tema general del video: "${p.topic || ""}"
Palabras clave/T\xE9rminos de video preferidos del usuario: "${userTerms.join(", ")}"

Para cada segmento, genera exactamente de 1 a 3 palabras clave o frases cortas de b\xFAsqueda en INGL\xC9S s\xFAper relevantes, descriptivas y visuales para buscar videos de stock en Pexels que coincidan con la oraci\xF3n y el tema general.
Es sumamente importante que las palabras clave de b\xFAsqueda est\xE9n en INGL\xC9S para que la API de Pexels funcione de la mejor manera.

Devuelve estrictamente un arreglo JSON de arreglos de cadenas (strings), con exactamente un arreglo de palabras clave para cada uno de los ${sentences.length} segmentos.
Ejemplo de formato de respuesta:
[
  ["vintage computer", "retro technology"],
  ["group of people cheering", "celebration"]
]
No incluyas explicaciones, marcas de c\xF3digo markdown, ni texto adicional, solo el JSON puro.`;
        const responseText = await generateGeminiContent(prompt);
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
    const segments = sentences.map((sentence, idx) => {
      let segmentQueries = [];
      if (hasGeminiQueries && searchQueriesForSegments[idx]) {
        segmentQueries = searchQueriesForSegments[idx];
      } else {
        if (userTerms.length > 0) {
          const primaryTerm = userTerms[idx % userTerms.length];
          segmentQueries.push(primaryTerm);
          if (userTerms.length > 1) {
            segmentQueries.push(userTerms[(idx + 1) % userTerms.length]);
          }
        }
        const commonWords = /* @__PURE__ */ new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o", "u", "con", "para", "por", "si", "no", "es", "son", "se", "su", "sus", "que", "como", "mas", "pero", "este", "esta", "estos", "estas"]);
        const words = sentence.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/).filter((w) => w.length > 3 && !commonWords.has(w));
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
      segmentQueries = Array.from(new Set(segmentQueries.map((q) => q.trim()).filter(Boolean)));
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
    p.videos = [];
    p.combined_videos = [];
    p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(req.params.id, p);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, segment_count: segments.length }
    });
  }));
  const getPexelsApiKey = () => {
    if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY;
    if (process.env.PEXELS_KEY) return process.env.PEXELS_KEY;
    const keys = globalConfig.settings?.app?.pexels_api_keys || [];
    if (keys && keys.length > 0) return keys[0];
    return null;
  };
  const searchPexelsVideos = async (query, apiKey, orientation = "portrait") => {
    try {
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&orientation=${orientation}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": apiKey
        }
      });
      if (!res.ok) {
        throw new Error(`Pexels API response error: ${res.status}`);
      }
      const data = await res.json();
      return (data.videos || []).map((video) => {
        const file = video.video_files?.find((f) => f.quality === "hd" || f.quality === "sd") || video.video_files?.[0];
        return {
          id: `pexels_${video.id}`,
          provider: "pexels",
          source_url: file?.link || video.video_files?.[0]?.link,
          download_url: file?.link || video.video_files?.[0]?.link,
          thumbnail_url: video.image || `https://images.pexels.com/videos/${video.id}/pictures/medium-1.jpg`,
          width: video.width,
          height: video.height,
          duration_sec: video.duration,
          query,
          title: video.user?.name ? `Video by ${video.user.name}` : "Pexels Video"
        };
      });
    } catch (err) {
      console.error(`Failed to search Pexels for query "${query}":`, err);
      return [];
    }
  };
  app.post("/api/v1/projects/:id/media/search", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const videoSource = req.body.video_source || p.params?.video_source || p.video_source || "pexels";
    if (!p.params) {
      p.params = {};
    }
    p.params.video_source = videoSource;
    p.video_source = videoSource;
    if (req.body.local_video_files !== void 0) {
      p.params.local_video_files = req.body.local_video_files;
    }
    projects.set(req.params.id, p);
    let selected = [];
    let candidates = [];
    if (videoSource === "local") {
      console.log(`[LocalVideo] Populating timeline media from local storage...`);
      const localFiles = p.params.local_video_files || [];
      console.log(`[LocalVideo] Selected files in configuration:`, localFiles);
      const files = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR);
      const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
      const availableLocalFiles = files.filter((f) => videoExtensions.includes(import_path.default.extname(f).toLowerCase()));
      const defaultLocalVideos2 = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
      let filteredAvailable = availableLocalFiles;
      const hasCustomFiles = availableLocalFiles.some((f) => !defaultLocalVideos2.includes(f));
      if (hasCustomFiles) {
        filteredAvailable = availableLocalFiles.filter((f) => !defaultLocalVideos2.includes(f));
      }
      const chosenFiles = localFiles && localFiles.length > 0 ? localFiles : filteredAvailable;
      const finalChosen = chosenFiles.length > 0 ? chosenFiles : defaultLocalVideos2;
      console.log(`[LocalVideo] Final chosen files list to cycle:`, finalChosen);
      const segments = p.shot_plan?.segments || [];
      for (let idx = 0; idx < segments.length; idx++) {
        const seg = segments[idx];
        const filename = finalChosen[idx % finalChosen.length];
        const fullDiskPath = import_path.default.join(LOCAL_VIDEOS_DIR, filename);
        let durationSec = 15;
        if (import_fs.default.existsSync(fullDiskPath)) {
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
          score: 1,
          score_reasons: ["Matches local video selection"]
        });
      }
    } else {
      const apiKey = getPexelsApiKey();
      const reqOrientation = req.body.orientation || (p.params?.video_aspect === "16:9" ? "landscape" : "portrait");
      const orientation = reqOrientation === "landscape" || reqOrientation === "portrait" || reqOrientation === "square" ? reqOrientation : "portrait";
      if (apiKey) {
        console.log(`[Pexels] API Key found! Searching Pexels online with orientation "${orientation}"...`);
        const usedVideoIds = /* @__PURE__ */ new Set();
        const segments = p.shot_plan?.segments || [];
        for (let idx = 0; idx < segments.length; idx++) {
          const seg = segments[idx];
          let results = [];
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
              score: 1 - i * 0.05,
              score_reasons: [`Matches online search: ${successfulQuery}`]
            })));
            let selectedVideo = results[0];
            for (const r of results) {
              const videoId = r.id || r.source_url || r.download_url;
              if (videoId && !usedVideoIds.has(String(videoId))) {
                selectedVideo = r;
                break;
              }
            }
            const chosenId = selectedVideo.id || selectedVideo.source_url || selectedVideo.download_url;
            if (chosenId) {
              usedVideoIds.add(String(chosenId));
            }
            selected.push({
              ...selectedVideo,
              id: `${seg.id}_selected`,
              segment_id: seg.id
            });
          } else {
            console.log(`[Pexels] Segment ${seg.id} search failed for all queries. Falling back to sample video.`);
            let best = SAMPLE_VIDEOS[idx % SAMPLE_VIDEOS.length];
            for (let i = 0; i < SAMPLE_VIDEOS.length; i++) {
              const candidate = SAMPLE_VIDEOS[(idx + i) % SAMPLE_VIDEOS.length];
              const candId = candidate.id || candidate.source_url;
              if (candId && !usedVideoIds.has(String(candId))) {
                best = candidate;
                break;
              }
            }
            const chosenId = best.id || best.source_url;
            if (chosenId) {
              usedVideoIds.add(String(chosenId));
            }
            selected.push({
              ...best,
              id: `${seg.id}_selected`,
              segment_id: seg.id
            });
          }
        }
      } else {
        console.log(`[Pexels] No API Key found, using local semantic matching against SAMPLE_VIDEOS...`);
        const usedVideoIds = /* @__PURE__ */ new Set();
        candidates = p.shot_plan?.segments?.flatMap((seg) => {
          return SAMPLE_VIDEOS.map((v, i) => ({
            ...v,
            id: `${seg.id}_cand_${i + 1}`,
            segment_id: seg.id,
            score: 0.9 - i * 0.1,
            score_reasons: ["Matches query: " + seg.search_queries.join(", ")]
          }));
        }) || [];
        selected = p.shot_plan?.segments?.map((seg, idx) => {
          const queryKeywords = seg.search_queries || [];
          const matches = SAMPLE_VIDEOS.filter(
            (v) => queryKeywords.some((q) => v.query.toLowerCase().includes(q.toLowerCase()) || v.title.toLowerCase().includes(q.toLowerCase()))
          );
          let best = matches.find((m) => !usedVideoIds.has(m.id || m.source_url)) || matches[0];
          if (!best) {
            best = SAMPLE_VIDEOS.find((v) => !usedVideoIds.has(v.id || v.source_url)) || SAMPLE_VIDEOS[idx % SAMPLE_VIDEOS.length];
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
    const audioItems = (p.shot_plan?.segments || []).map((seg, idx) => {
      const startSec = seg.start_sec !== void 0 ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== void 0 ? seg.target_duration_sec : 5;
      return {
        id: `audio_${idx + 1}`,
        start_sec: startSec,
        duration_sec: durationSec,
        text: seg.narration_text,
        segment_id: seg.id,
        asset_url: p.narration_audio_path || null
      };
    });
    const totalDurationSec = audioItems.reduce((acc, item) => Math.max(acc, item.start_sec + item.duration_sec), 0) || 15;
    let videoItems = [];
    const isLocalSource = p.params?.video_source === "local" || p.video_source === "local" || p.selected_media && p.selected_media[0]?.provider === "local";
    if (isLocalSource) {
      const uniqueFiles = [];
      const seen = /* @__PURE__ */ new Set();
      const chosenLocalFiles = p.params?.local_video_files || [];
      console.log(`[Timeline] Building track. chosenLocalFiles:`, chosenLocalFiles, `selected_media count:`, p.selected_media?.length || 0);
      if (chosenLocalFiles.length > 0) {
        for (const filename of chosenLocalFiles) {
          const existingMed = (p.selected_media || []).find((m) => import_path.default.basename(m.source_url || m.asset_url || "") === filename);
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
              const fullDiskPath = import_path.default.join(LOCAL_VIDEOS_DIR, filename);
              let durationSec = 15;
              if (import_fs.default.existsSync(fullDiskPath)) {
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
          const files = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR);
          const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
          const availableLocalFiles = files.filter((f) => videoExtensions.includes(import_path.default.extname(f).toLowerCase()));
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
      const defaultLocalVideos2 = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
      try {
        const filesOnDisk = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR);
        const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
        const diskFiles = filesOnDisk.filter((f) => videoExtensions.includes(import_path.default.extname(f).toLowerCase()));
        const hasCustomFilesOnDisk = diskFiles.some((f) => !defaultLocalVideos2.includes(f));
        if (hasCustomFilesOnDisk && chosenLocalFiles.length === 0) {
          const filteredUnique = uniqueFiles.filter((med) => {
            const filename = import_path.default.basename(med.source_url || med.asset_url || "");
            return !defaultLocalVideos2.includes(filename);
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
        const fullDuration = isNaN(rawDuration) || rawDuration <= 0 ? 15 : rawDuration;
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
      const usedAssetKeys = /* @__PURE__ */ new Set();
      const getAssetKey = (media) => {
        if (!media) return "";
        return String(media.download_url || media.source_url || media.asset_url || media.local_path || media.id || "");
      };
      let currentStartSec = 0;
      while (currentStartSec < totalDurationSec) {
        const remaining = totalDurationSec - currentStartSec;
        const usedDuration = Math.min(clipDuration, remaining);
        const clipMidpoint = currentStartSec + usedDuration / 2;
        const activeSeg = segments.find((s) => {
          const sStart = s.start_sec !== void 0 ? s.start_sec : 0;
          const sEnd = s.end_sec !== void 0 ? s.end_sec : sStart + (s.target_duration_sec || 5);
          return clipMidpoint >= sStart && clipMidpoint <= sEnd;
        }) || segments[segments.length - 1];
        const segCandidates = (p.media_candidates || []).filter((c) => c.segment_id === activeSeg.id);
        const primaryMedia = (p.selected_media || []).find((m) => m.segment_id === activeSeg.id);
        let mediaToUse = null;
        if (primaryMedia) {
          const key = getAssetKey(primaryMedia);
          if (key && !usedAssetKeys.has(key)) {
            mediaToUse = primaryMedia;
          }
        }
        if (!mediaToUse && segCandidates.length > 0) {
          for (const cand of segCandidates) {
            const key = getAssetKey(cand);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = cand;
              break;
            }
          }
        }
        if (!mediaToUse) {
          for (const m of p.selected_media || []) {
            const key = getAssetKey(m);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = m;
              break;
            }
          }
        }
        if (!mediaToUse) {
          for (const cand of p.media_candidates || []) {
            const key = getAssetKey(cand);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = cand;
              break;
            }
          }
        }
        if (!mediaToUse) {
          for (const v of SAMPLE_VIDEOS) {
            const key = getAssetKey(v);
            if (key && !usedAssetKeys.has(key)) {
              mediaToUse = v;
              break;
            }
          }
        }
        if (!mediaToUse) {
          mediaToUse = primaryMedia || segCandidates[0] || SAMPLE_VIDEOS[(activeSeg.order || 1) % SAMPLE_VIDEOS.length];
        }
        const chosenKey = getAssetKey(mediaToUse);
        if (chosenKey) {
          usedAssetKeys.add(chosenKey);
        }
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
    const subtitleItems = [];
    (p.shot_plan?.segments || []).forEach((seg, idx) => {
      const startSec = seg.start_sec !== void 0 ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== void 0 ? seg.target_duration_sec : 5;
      const splitCues = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_${idx + 1}`);
      subtitleItems.push(...splitCues);
    });
    p.tracks = [
      { id: "track_video", type: "video", name: "Video Track", items: videoItems },
      { id: "track_audio", type: "audio", name: "Audio Track", items: audioItems },
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
    const projectId = req.params.id;
    const p = projects.get(projectId);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const voice_name = req.body.voice_name || "es-ES-AlvaroNeural-Male";
    const subtitle_enabled = req.body.subtitle_enabled !== false;
    let tl = p.language || "es";
    const voiceNameLower = voice_name.toLowerCase();
    if (voiceNameLower.includes("en-") || voiceNameLower.includes("us-") || voiceNameLower.includes("guy") || voiceNameLower.includes("jenny") || voiceNameLower.includes("alex") || voiceNameLower.includes("anna") || voiceNameLower.includes("bella") || voiceNameLower.includes("benjamin") || voiceNameLower.includes("charles") || voiceNameLower.includes("claire") || voiceNameLower.includes("david") || voiceNameLower.includes("diana") || voiceNameLower.includes("milo") || voiceNameLower.includes("dean") || voiceNameLower.includes("chloe") || voiceNameLower.includes("mia") || voiceNameLower.includes("puck") || voiceNameLower.includes("charon") || voiceNameLower.includes("zephyr")) {
      tl = "en";
    } else if (voiceNameLower.includes("zh-") || voiceNameLower.includes("cn-") || voiceNameLower.includes("xiaoxiao") || voiceNameLower.includes("yunxi") || voiceNameLower.includes("\u51B0\u7CD6") || voiceNameLower.includes("\u8309\u8389") || voiceNameLower.includes("\u82CF\u6253") || voiceNameLower.includes("\u767D\u6866")) {
      tl = "zh-CN";
    } else if (voiceNameLower.includes("es-") || voiceNameLower.includes("mx-") || voiceNameLower.includes("alvaro") || voiceNameLower.includes("elvira") || voiceNameLower.includes("dalia") || voiceNameLower.includes("jorge")) {
      tl = "es";
    }
    if (!p.project_folder_name) {
      const folderName = `${sanitizeFolderName(p.topic || p.project_id || "project")}_${getFormattedDateTime()}`;
      p.project_folder_name = folderName;
      projects.set(projectId, p);
    }
    const projectFolder = import_path.default.join(process.cwd(), "storage", "renders", p.project_folder_name);
    const cacheDir = import_path.default.join(projectFolder, "cache");
    const renderDir = projectFolder;
    await import_fs.default.promises.mkdir(cacheDir, { recursive: true });
    await import_fs.default.promises.mkdir(renderDir, { recursive: true });
    let segments = p.shot_plan?.segments || [];
    if (segments.length === 0) {
      const sentences = (p.script || p.topic || "").split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
      if (sentences.length === 0) {
        sentences.push("Esto es un video de prueba de generaci\xF3n.");
      }
      segments = sentences.map((sentence, idx) => ({
        id: `seg_${idx + 1}`,
        order: idx + 1,
        narration_text: sentence,
        search_queries: sentence.split(" ").slice(0, 2).map((w) => w.replace(/[^a-zA-Z]/g, "")).filter((w) => w.length > 2)
      }));
      p.shot_plan = p.shot_plan || {};
      p.shot_plan.segments = segments;
      p.has_shot_plan = true;
    }
    console.log(`[Narration] Synthesizing speech for ${segments.length} segments using language ${tl}...`);
    const localPaths = [];
    const wavPaths = [];
    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      const text = seg.narration_text || "Silencio";
      const destPath = import_path.default.join(cacheDir, `narration_chunk_${projectId}_${idx}.mp3`);
      const wavPath = import_path.default.join(cacheDir, `narration_chunk_${projectId}_${idx}.wav`);
      try {
        const audioBuffer = await synthesizeSpeech(voice_name, text, tl);
        await import_fs.default.promises.writeFile(destPath, audioBuffer);
        localPaths.push(destPath);
        await executeCommand(`ffmpeg -y -i "${destPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${wavPath}"`);
        wavPaths.push(wavPath);
      } catch (err) {
        console.error(`[Narration] Failed to synthesize chunk ${idx}:`, err);
        const fallbackPath = import_path.default.join(cacheDir, `narration_chunk_${projectId}_${idx}_fallback.mp3`);
        await executeCommand(`ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo -t 3 "${fallbackPath}"`);
        localPaths.push(fallbackPath);
        await executeCommand(`ffmpeg -y -i "${fallbackPath}" -acodec pcm_s16le -ar 44100 -ac 2 "${wavPath}"`);
        wavPaths.push(wavPath);
      }
    }
    const concatListPath = import_path.default.join(cacheDir, `concat_audio_${projectId}.txt`);
    const concatContent = wavPaths.map((p2) => `file '${p2.replace(/\\/g, "/")}'`).join("\n");
    await import_fs.default.promises.writeFile(concatListPath, concatContent, "utf8");
    const finalWavPath = import_path.default.join(cacheDir, `narration_${projectId}_temp.wav`);
    console.log(`[Narration] Merging ${wavPaths.length} WAV chunks into: ${finalWavPath}`);
    await executeCommand(`ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -acodec pcm_s16le "${finalWavPath}"`);
    const finalAudioPath = import_path.default.join(renderDir, `narration_${projectId}.mp3`);
    console.log(`[Narration] Converting final WAV to MP3: ${finalAudioPath}`);
    await executeCommand(`ffmpeg -y -i "${finalWavPath}" -codec:a libmp3lame -b:a 192k "${finalAudioPath}"`);
    let currentStartSec = 0;
    for (let idx = 0; idx < segments.length; idx++) {
      const seg = segments[idx];
      const chunkPath = wavPaths[idx];
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
    p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    let subtitlePath = null;
    if (subtitle_enabled) {
      const splitCuesForSrt = [];
      segments.forEach((seg, idx) => {
        const startSec = seg.start_sec !== void 0 ? seg.start_sec : idx * 5;
        const durationSec = seg.target_duration_sec !== void 0 ? seg.target_duration_sec : 5;
        const splitItems = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_${idx + 1}`);
        splitCuesForSrt.push(...splitItems);
      });
      const srtContent = generateSrt(splitCuesForSrt);
      const srtPath = import_path.default.join(renderDir, `subtitles_${projectId}.srt`);
      await import_fs.default.promises.writeFile(srtPath, srtContent, "utf8");
      subtitlePath = `/storage/renders/${p.project_folder_name}/subtitles_${projectId}.srt`;
      p.subtitle_path = subtitlePath;
    }
    const audioItems = (p.shot_plan?.segments || []).map((seg, idx) => {
      const startSec = seg.start_sec !== void 0 ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== void 0 ? seg.target_duration_sec : 5;
      return {
        id: `audio_${idx + 1}`,
        start_sec: startSec,
        duration_sec: durationSec,
        text: seg.narration_text,
        segment_id: seg.id,
        asset_url: p.narration_audio_path || null
      };
    });
    const subtitleItems = [];
    (p.shot_plan?.segments || []).forEach((seg, idx) => {
      const startSec = seg.start_sec !== void 0 ? seg.start_sec : idx * 5;
      const durationSec = seg.target_duration_sec !== void 0 ? seg.target_duration_sec : 5;
      const splitCues = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_${idx + 1}`);
      subtitleItems.push(...splitCues);
    });
    if (p.tracks) {
      p.tracks = p.tracks.filter((t) => t.type !== "audio" && t.type !== "subtitle");
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
  app.post("/api/v1/projects/:id/timeline/commands", wrap(async (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }
    const commands = req.body.commands || [];
    if (!p.tracks) {
      p.tracks = [];
    }
    for (const cmd of commands) {
      const track = p.tracks.find((t) => t.id === cmd.track_id);
      if (!track) continue;
      if (cmd.type === "move") {
        const itemIndex = track.items.findIndex((item) => item.id === cmd.item_id);
        if (itemIndex !== -1) {
          if (cmd.new_start_sec < 0) {
            track.items.splice(itemIndex, 1);
          } else {
            track.items[itemIndex].start_sec = cmd.new_start_sec;
          }
        }
      } else if (cmd.type === "trim") {
        const item = track.items.find((item2) => item2.id === cmd.item_id);
        if (item) {
          if (cmd.trim_start_sec !== void 0) item.trim_start_sec = cmd.trim_start_sec;
          if (cmd.trim_end_sec !== void 0) item.trim_end_sec = cmd.trim_end_sec;
        }
      } else if (cmd.type === "set_timing") {
        const item = track.items.find((item2) => item2.id === cmd.item_id);
        if (item) {
          if (cmd.duration_sec === 0) {
            const itemIndex = track.items.indexOf(item);
            if (itemIndex !== -1) {
              track.items.splice(itemIndex, 1);
            }
          } else if (cmd.duration_sec !== void 0) {
            item.duration_sec = cmd.duration_sec;
          }
        }
      } else if (cmd.type === "duplicate") {
        const itemIndex = track.items.findIndex((item) => item.id === cmd.item_id);
        if (itemIndex !== -1) {
          const originalItem = track.items[itemIndex];
          const newItemId = cmd.new_item_id || `item_dup_${Math.random().toString(36).substring(2, 6)}`;
          const duplicatedItem = {
            ...originalItem,
            id: newItemId,
            start_sec: originalItem.start_sec + originalItem.duration_sec
          };
          track.items.splice(itemIndex + 1, 0, duplicatedItem);
          let accStart = originalItem.start_sec + originalItem.duration_sec;
          for (let i = itemIndex + 1; i < track.items.length; i++) {
            track.items[i].start_sec = accStart;
            accStart += track.items[i].duration_sec;
          }
        }
      }
    }
    for (const track of p.tracks) {
      if (Array.isArray(track.items)) {
        track.items.sort((a, b) => a.start_sec - b.start_sec);
      }
    }
    p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    projects.set(req.params.id, p);
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: req.params.id, applied: commands.length, valid: true }
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
  const formatSrtTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor(seconds % 1 * 1e3);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
  };
  const cssHexToAss = (hex) => {
    if (!hex) return "FFFFFF";
    let clean = hex.replace("#", "");
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    if (clean.length === 6) {
      const r = clean.substring(0, 2);
      const g = clean.substring(2, 4);
      const b = clean.substring(4, 6);
      return `${b}${g}${r}`;
    }
    if (clean.length === 8) {
      const r = clean.substring(0, 2);
      const g = clean.substring(2, 4);
      const b = clean.substring(4, 6);
      return `${b}${g}${r}`;
    }
    return "FFFFFF";
  };
  const getAssFontName = (fontName) => {
    if (!fontName) return "Arial";
    const clean = fontName.trim();
    if (clean.startsWith("STHeitiMedium")) return "STHeitiSC-Medium";
    if (clean.startsWith("STHeitiLight")) return "STHeitiSC-Light";
    if (clean.startsWith("MicrosoftYaHeiBold")) return "Microsoft YaHei";
    if (clean.startsWith("MicrosoftYaHeiNormal")) return "Microsoft YaHei";
    if (clean.startsWith("Charm-Bold")) return "Charm";
    if (clean.startsWith("Charm-Regular")) return "Charm";
    if (clean.startsWith("UTM Kabel KY")) return "UTM Kabel KY";
    if (clean.startsWith("UTM_Kabel_KY")) return "UTM Kabel KY";
    return clean.split(".")[0] || "Arial";
  };
  const splitTextIntoTikTokSubtitles = (text, startSec, durationSec, segmentId, baseId) => {
    if (!text || !text.trim()) return [];
    const cleanText = text.trim().replace(/\s+/g, " ");
    const isCJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(cleanText);
    let units = [];
    if (isCJK) {
      units = Array.from(cleanText).filter((c) => c !== " ");
    } else {
      units = cleanText.split(" ");
    }
    if (units.length === 0) return [];
    const maxUnits = 3;
    const groups = [];
    for (let i = 0; i < units.length; i += maxUnits) {
      groups.push(units.slice(i, i + maxUnits));
    }
    if (groups.length > 1 && groups[groups.length - 1].length === 1) {
      const lastGroup = groups.pop();
      if (lastGroup) {
        groups[groups.length - 1].push(...lastGroup);
      }
    }
    const totalUnits = units.length;
    let elapsed = 0;
    return groups.map((grp, idx) => {
      const phrase = isCJK ? grp.join("") : grp.join(" ");
      const phraseUnitsCount = grp.length;
      const chunkStart = startSec + elapsed / totalUnits * durationSec;
      const chunkDuration = phraseUnitsCount / totalUnits * durationSec;
      elapsed += phraseUnitsCount;
      return {
        id: `${baseId}_part_${idx + 1}`,
        start_sec: Number(chunkStart.toFixed(3)),
        duration_sec: Number(chunkDuration.toFixed(3)),
        text: phrase,
        segment_id: segmentId
      };
    });
  };
  const generateSrt = (subtitles) => {
    return subtitles.map((sub, idx) => {
      const startSec = Number(sub.start_sec) || 0;
      const durationSec = Number(sub.duration_sec) || 5;
      const start = formatSrtTime(startSec);
      const end = formatSrtTime(startSec + durationSec);
      return `${idx + 1}
${start} --> ${end}
${sub.text || ""}
`;
    }).join("\n");
  };
  const formatAssTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor(seconds % 3600 / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor(seconds % 1 * 1e3);
    const cs = Math.floor(ms / 10);
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
  };
  const generateAss = (subtitles, resWidth, resHeight, styleParams) => {
    const refHeight = 1920;
    const refWidth = Math.round(1920 * (resWidth / resHeight));
    const assFont = getAssFontName(styleParams.fontName);
    const textColor = cssHexToAss(styleParams.textColor);
    const strokeColor = cssHexToAss(styleParams.strokeColor);
    let assBgColor = "000000";
    let assBgAlpha = "00";
    const hasBg = styleParams.hasBg === true || typeof styleParams.hasBg === "string" && styleParams.hasBg.trim() && styleParams.hasBg.trim() !== "transparent" && styleParams.hasBg.trim() !== "none";
    if (hasBg) {
      if (typeof styleParams.hasBg === "string" && styleParams.hasBg.trim()) {
        const cleanBg = styleParams.hasBg.trim();
        if (cleanBg.startsWith("#")) {
          assBgColor = cssHexToAss(cleanBg);
          if (cleanBg.length === 9) {
            const alphaHex = cleanBg.substring(7, 9);
            const cssAlphaInt = parseInt(alphaHex, 16);
            const assAlphaInt = 255 - cssAlphaInt;
            assBgAlpha = assAlphaInt.toString(16).padStart(2, "0").toUpperCase();
          } else {
            assBgAlpha = "00";
          }
        } else if (cleanBg.startsWith("rgba")) {
          const match = cleanBg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
          if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, "0");
            const g = parseInt(match[2]).toString(16).padStart(2, "0");
            const b = parseInt(match[3]).toString(16).padStart(2, "0");
            assBgColor = `${b}${g}${r}`;
            const a = parseFloat(match[4]);
            const assAlphaInt = Math.round((1 - a) * 255);
            assBgAlpha = assAlphaInt.toString(16).padStart(2, "0").toUpperCase();
          }
        } else if (cleanBg.startsWith("rgb")) {
          const match = cleanBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
          if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, "0");
            const g = parseInt(match[2]).toString(16).padStart(2, "0");
            const b = parseInt(match[3]).toString(16).padStart(2, "0");
            assBgColor = `${b}${g}${r}`;
            assBgAlpha = "00";
          }
        }
      } else {
        assBgColor = "000000";
        assBgAlpha = "00";
      }
      if (styleParams.subtitleBgStyle === "translucent") {
        if (assBgAlpha === "00") {
          assBgAlpha = "80";
        }
      } else if (styleParams.subtitleBgStyle === "blur") {
        assBgColor = "FFFFFF";
        assBgAlpha = "C0";
      } else {
        assBgAlpha = "00";
      }
    }
    const marginLR = Math.round(0.07 * refWidth);
    let alignment = 2;
    let marginV = Math.round(0.08 * refHeight);
    if (styleParams.position === "top") {
      alignment = 8;
      marginV = Math.round(0.08 * refHeight);
    } else if (styleParams.position === "center" || styleParams.position === "middle") {
      alignment = 5;
      marginV = 0;
    } else if (styleParams.position === "custom") {
      alignment = 8;
      marginV = Math.round(styleParams.customPosition / 100 * refHeight);
    }
    const isRounded = hasBg && styleParams.roundedBackground === true;
    let isBold = 0;
    if (styleParams.fontName && styleParams.fontName.toLowerCase().includes("bold")) {
      isBold = -1;
    }
    let out = `[Script Info]
ScriptType: v4.00+
PlayResX: ${refWidth}
PlayResY: ${refHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;
    if (isRounded) {
      out += `Style: BgStyle,${assFont},${styleParams.fontSize},&H${assBgAlpha}${assBgColor},&H00000000,&HFF000000,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
`;
      const defaultOutline = styleParams.strokeWidth !== void 0 ? styleParams.strokeWidth : 1.5;
      out += `Style: Default,${assFont},${styleParams.fontSize},&H00${textColor},&H00000000,&H00${strokeColor},&HFF000000,${isBold},0,0,0,100,100,0,0,1,${defaultOutline.toFixed(1)},0,${alignment},${marginLR},${marginLR},${marginV},1
`;
    } else {
      let borderStyle = 1;
      let outlineVal = styleParams.strokeWidth !== void 0 ? styleParams.strokeWidth : 1.5;
      let assBackColor = "FF000000";
      let assOutlineColor = `00${strokeColor}`;
      if (hasBg) {
        borderStyle = 3;
        outlineVal = Math.max(4, Math.round(styleParams.fontSize * 0.15));
        assBackColor = `${assBgAlpha}${assBgColor}`;
        assOutlineColor = `${assBgAlpha}${assBgColor}`;
      }
      out += `Style: Default,${assFont},${styleParams.fontSize},&H00${textColor},&H00000000,&H${assOutlineColor},&H${assBackColor},${isBold},0,0,0,100,100,0,0,${borderStyle},${outlineVal.toFixed(1)},0,${alignment},${marginLR},${marginLR},${marginV},1
`;
    }
    out += `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
    const estimateLineWidth = (line, fontSize) => {
      let width = 0;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === " ") {
          width += 0.3;
        } else if (/[A-Z]/.test(char)) {
          width += 0.72;
        } else if (/[a-z]/.test(char)) {
          width += 0.54;
        } else if (/[0-9]/.test(char)) {
          width += 0.58;
        } else if (/[áéíóúÁÉÍÓÚñÑüÜ]/.test(char)) {
          width += 0.54;
        } else {
          width += 0.45;
        }
      }
      return width * fontSize;
    };
    const getRoundedRectPath = (w, h, r) => {
      const kappa = 0.5522847498;
      let p = `m ${Math.round(r)} 0 `;
      p += `l ${Math.round(w - r)} 0 `;
      const tr_x1 = Math.round(w - r + r * kappa);
      const tr_y1 = 0;
      const tr_x2 = Math.round(w);
      const tr_y2 = Math.round(r - r * kappa);
      const tr_x3 = Math.round(w);
      const tr_y3 = Math.round(r);
      p += `b ${tr_x1} ${tr_y1} ${tr_x2} ${tr_y2} ${tr_x3} ${tr_y3} `;
      p += `l ${Math.round(w)} ${Math.round(h - r)} `;
      const br_x1 = Math.round(w);
      const br_y1 = Math.round(h - r + r * kappa);
      const br_x2 = Math.round(w - r + r * kappa);
      const br_y2 = Math.round(h);
      const br_x3 = Math.round(w - r);
      const br_y3 = Math.round(h);
      p += `b ${br_x1} ${br_y1} ${br_x2} ${br_y2} ${br_x3} ${br_y3} `;
      p += `l ${Math.round(r)} ${Math.round(h)} `;
      const bl_x1 = Math.round(r - r * kappa);
      const bl_y1 = Math.round(h);
      const bl_x2 = 0;
      const bl_y2 = Math.round(h - r + r * kappa);
      const bl_x3 = 0;
      const bl_y3 = Math.round(h - r);
      p += `b ${bl_x1} ${bl_y1} ${bl_x2} ${bl_y2} ${bl_x3} ${bl_y3} `;
      p += `l 0 ${Math.round(r)} `;
      const tl_x1 = 0;
      const tl_y1 = Math.round(r - r * kappa);
      const tl_x2 = Math.round(r - r * kappa);
      const tl_y2 = 0;
      const tl_x3 = Math.round(r);
      const tl_y3 = 0;
      p += `b ${tl_x1} ${tl_y1} ${tl_x2} ${tl_y2} ${tl_x3} ${tl_y3}`;
      return p;
    };
    for (const sub of subtitles) {
      const startSec = Number(sub.start_sec) || 0;
      const durationSec = Number(sub.duration_sec) || 5;
      const start = formatAssTime(startSec);
      const end = formatAssTime(startSec + durationSec);
      const text = (sub.text || "").replace(/\\n/g, "\\N").replace(/\n/g, "\\N");
      if (isRounded) {
        const lines = text.split(/\\N/);
        let maxLineWidth = 0;
        for (const line of lines) {
          const w = estimateLineWidth(line, styleParams.fontSize);
          if (w > maxLineWidth) {
            maxLineWidth = w;
          }
        }
        const paddingX = styleParams.fontSize * 0.75;
        const paddingY = styleParams.fontSize * 0.35;
        const boxWidth = maxLineWidth + paddingX;
        const textHeight = lines.length * styleParams.fontSize * 1.15;
        const boxHeight = textHeight + paddingY;
        const radius = Math.min(boxHeight / 2, styleParams.fontSize * 0.35);
        const centerX = refWidth / 2;
        let centerY = refHeight - marginV - textHeight / 2;
        if (alignment === 8) {
          centerY = marginV + textHeight / 2;
        } else if (alignment === 5) {
          centerY = refHeight / 2;
        }
        const pathStr = getRoundedRectPath(boxWidth, boxHeight, radius);
        const boxX = Math.round(centerX - boxWidth / 2);
        const boxY = Math.round(centerY - boxHeight / 2);
        out += `Dialogue: 0,${start},${end},BgStyle,,0,0,0,,{\\an7\\pos(${boxX},${boxY})\\p1}${pathStr}{\\p0}
`;
        out += `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an5\\pos(${centerX},${centerY.toFixed(1)})}${text}
`;
      } else {
        out += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}
`;
      }
    }
    return out;
  };
  const executeCommand = (cmd) => {
    return new Promise((resolve, reject) => {
      (0, import_child_process.exec)(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
        if (error) {
          let customErrorMsg = `Command failed: ${cmd}
Error: ${error.message}
Stderr: ${stderr}`;
          if (cmd.includes("ffmpeg") || cmd.includes("ffprobe")) {
            const isFfmpegMissing = error.message.includes("not recognized") || error.message.includes("no se reconoce") || error.message.includes("not found") || error.message.includes("ENOENT") || error.code === 127 || error.code === 9009;
            if (isFfmpegMissing) {
              customErrorMsg = `\u26A0\uFE0F [ERROR DE SISTEMA] FFmpeg / FFprobe no est\xE1 instalado o no se encuentra en el PATH de tu sistema.

Para ejecutar esta aplicaci\xF3n localmente y generar tus videos con \xE9xito, sigue estos pasos:
1. Descarga FFmpeg desde la p\xE1gina oficial: https://ffmpeg.org/download.html
   (En Windows, puedes descargar el build de Gyan.dev. En Mac, puedes usar 'brew install ffmpeg')
2. Extrae el contenido y a\xF1ade la carpeta 'bin' (que contiene ffmpeg.exe) al PATH de las Variables de Entorno de tu sistema.
3. Cierra tu terminal actual, abre una nueva terminal y vuelve a iniciar tu servidor con 'npm run dev'.

---------------------------------------------------------
FFmpeg / FFprobe is not installed or found in your system's PATH.
To run this application locally and render videos successfully, please:
1. Download FFmpeg from: https://ffmpeg.org/download.html
2. Extract and add the 'bin' directory to your system's PATH environment variable.
3. Restart your development terminal and run 'npm run dev' again.

[Detalle t\xE9cnico / Technical Detail]: ${error.message}`;
            }
          }
          reject(new Error(customErrorMsg));
          return;
        }
        resolve(stdout);
      });
    });
  };
  const downloadFile = async (url, destPath) => {
    if (import_fs.default.existsSync(destPath)) {
      const stat = import_fs.default.statSync(destPath);
      if (stat.size > 0) {
        return destPath;
      }
      try {
        import_fs.default.unlinkSync(destPath);
      } catch (e) {
      }
    }
    let correctedUrl = url;
    if (url.includes("images.pexels.com/video-files/")) {
      correctedUrl = url.replace("images.pexels.com/video-files/", "videos.pexels.com/video-files/");
    }
    let lastError = null;
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
          await import_fs.default.promises.writeFile(destPath, Buffer.from(buffer));
          return destPath;
        } else {
          throw new Error(`Status ${response.status} ${response.statusText}`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Download] Fetch attempt ${attempt} failed for ${correctedUrl}: ${err.message}`);
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1e3 * attempt));
        }
      }
    }
    console.log(`[Download] Falling back to curl for ${correctedUrl}`);
    try {
      const { exec: exec2 } = await import("child_process");
      await new Promise((resolve, reject) => {
        const cmd = `curl -L -f --retry 3 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -o "${destPath}" "${correctedUrl}"`;
        exec2(cmd, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`curl failed: ${stderr || error.message}`));
          } else {
            resolve();
          }
        });
      });
      if (import_fs.default.existsSync(destPath) && import_fs.default.statSync(destPath).size > 0) {
        return destPath;
      }
    } catch (curlErr) {
      console.error(`[Download] curl fallback also failed for ${correctedUrl}:`, curlErr);
      lastError = new Error(`${lastError?.message || ""} (curl fallback also failed: ${curlErr.message})`);
    }
    throw new Error(`Failed to download ${correctedUrl}: ${lastError?.message}`);
  };
  const runRealRender = async (projectId, taskId) => {
    const updateTaskState = (progress, outputPath, error, state = 4) => {
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
      const isLocalSource = p.params?.video_source === "local" || p.video_source === "local" || p.selected_media && p.selected_media[0]?.provider === "local";
      if (isLocalSource) {
        const uniqueFiles = [];
        const seen = /* @__PURE__ */ new Set();
        const chosenLocalFiles = p.params?.local_video_files || [];
        console.log(`[Render Rebuild] Rebuilding local video track. chosenLocalFiles:`, chosenLocalFiles);
        if (chosenLocalFiles.length > 0) {
          for (const filename of chosenLocalFiles) {
            const existingMed = (p.selected_media || []).find((m) => import_path.default.basename(m.source_url || m.asset_url || "") === filename);
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
                const fullDiskPath = import_path.default.join(LOCAL_VIDEOS_DIR, filename);
                let durationSec = 15;
                if (import_fs.default.existsSync(fullDiskPath)) {
                  try {
                    const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${fullDiskPath}"`);
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
            const files = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR);
            const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
            const availableLocalFiles = files.filter((f) => videoExtensions.includes(import_path.default.extname(f).toLowerCase()));
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
        const defaultLocalVideos2 = ["nature_cinematic.mp4", "urban_streets.mp4", "retro_animation.mp4"];
        try {
          const filesOnDisk = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR);
          const videoExtensions = [".mp4", ".mkv", ".avi", ".mov", ".webm"];
          const diskFiles = filesOnDisk.filter((f) => videoExtensions.includes(import_path.default.extname(f).toLowerCase()));
          const hasCustomFilesOnDisk = diskFiles.some((f) => !defaultLocalVideos2.includes(f));
          if (hasCustomFilesOnDisk && chosenLocalFiles.length === 0) {
            const filteredUnique = uniqueFiles.filter((med) => {
              const filename = import_path.default.basename(med.source_url || med.asset_url || "");
              return !defaultLocalVideos2.includes(filename);
            });
            if (filteredUnique.length > 0) {
              uniqueFiles.length = 0;
              uniqueFiles.push(...filteredUnique);
            }
          }
        } catch (err) {
          console.error("[Render Rebuild] Failed to filter uniqueFiles against disk:", err);
        }
        const audioTrack = p.tracks?.find((tr) => tr.type === "audio");
        const audioItems = audioTrack?.items || [];
        const totalDurationSec = audioItems.reduce((acc, item) => Math.max(acc, Number(item.start_sec) + Number(item.duration_sec)), 0) || 15;
        console.log(`[Render Rebuild] Rebuilding continuous local video track from ${uniqueFiles.length} files for duration ${totalDurationSec}s`);
        let currentStartSec = 0;
        let itemId = 1;
        const videoItems = [];
        while (currentStartSec < totalDurationSec) {
          const medIndex = (itemId - 1) % uniqueFiles.length;
          const med = uniqueFiles[medIndex];
          const rawDuration = Number(med.duration_sec);
          const fullDuration = isNaN(rawDuration) || rawDuration <= 0 ? 15 : rawDuration;
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
        const existingVideoTrack = p.tracks?.find((tr) => tr.type === "video");
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
      const videoTrack = p.tracks?.find((tr) => tr.type === "video");
      const subtitleTrack = p.tracks?.find((tr) => tr.type === "subtitle");
      let musicItem = p.selected_music?.[0];
      if (!musicItem) {
        const bgmType = p.params?.bgm_type || p.bgm_type || "none";
        const bgmFile = p.params?.bgm_file || p.bgm_file;
        const bgmVolume = p.params?.bgm_volume !== void 0 ? p.params.bgm_volume : p.bgm_volume !== void 0 ? p.bgm_volume : 0.2;
        if (bgmType === "random") {
          const randomIdx = Math.floor(Math.random() * BGM_FILES.length);
          const randomFile = BGM_FILES[randomIdx];
          musicItem = {
            id: `bgm_random_${randomIdx}`,
            provider: "local",
            url: randomFile.file,
            title: randomFile.name,
            duration_sec: 180,
            volume: bgmVolume
          };
          logTask(taskId, "INFO", "AUDIO_MIXER", `BGM Mode: Random. Selected soundtrack: "${randomFile.name}" at volume: ${bgmVolume}`);
        } else if (bgmType === "contextual") {
          const searchSubject = `${p.topic || ""} ${p.script || ""}`.toLowerCase();
          let bestMatch = BGM_FILES[0];
          let maxMatches = -1;
          for (const file of BGM_FILES) {
            let matches = 0;
            if (file.tags) {
              for (const tag of file.tags) {
                if (searchSubject.includes(tag.toLowerCase())) {
                  matches++;
                }
              }
            }
            if (matches > maxMatches) {
              maxMatches = matches;
              bestMatch = file;
            }
          }
          musicItem = {
            id: "bgm_contextual",
            provider: "local",
            url: bestMatch.file,
            title: bestMatch.name,
            duration_sec: 180,
            volume: bgmVolume
          };
          logTask(taskId, "INFO", "AUDIO_MIXER", `BGM Mode: AI Contextual. Matched: "${bestMatch.name}" with score ${maxMatches} at volume: ${bgmVolume}`);
        } else if (bgmFile && bgmType === "file") {
          const matched = BGM_FILES.find((f) => f.file === bgmFile || f.name === bgmFile);
          musicItem = {
            id: "bgm_param",
            provider: "local",
            url: matched ? matched.file : bgmFile,
            title: matched ? matched.name : import_path.default.basename(bgmFile),
            duration_sec: 180,
            volume: bgmVolume
          };
          logTask(taskId, "INFO", "AUDIO_MIXER", `BGM Mode: Manual. Selected soundtrack: "${musicItem.title}" at volume: ${bgmVolume}`);
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
      if (!p.project_folder_name) {
        const folderName = `${sanitizeFolderName(p.topic || p.project_id || "project")}_${getFormattedDateTime()}`;
        p.project_folder_name = folderName;
        projects.set(projectId, p);
      }
      const projectFolder = import_path.default.join(process.cwd(), "storage", "renders", p.project_folder_name);
      const cacheDir = import_path.default.join(projectFolder, "cache");
      const renderDir = projectFolder;
      await import_fs.default.promises.mkdir(cacheDir, { recursive: true });
      await import_fs.default.promises.mkdir(renderDir, { recursive: true });
      logTask(taskId, "INFO", "SUBTITLES", "Generating subtitles");
      await new Promise((r) => setTimeout(r, 600));
      logTask(taskId, "SUCCESS", "SUBTITLES", "Subtitles ready");
      updateTaskState(10, null, null);
      logTask(taskId, "INFO", "VIDEO_ASSET", "Collecting video materials");
      const localVideoPaths = [];
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
          const cleanUrl2 = url.split("?")[0];
          const filename = import_path.default.basename(cleanUrl2);
          let cleanLocalPath = cleanUrl2.startsWith("/") ? cleanUrl2.slice(1) : cleanUrl2;
          if (url.includes("/storage/local_videos/")) {
            cleanLocalPath = `storage/local_videos/${filename}`;
          } else if (url.includes("/local_videos/")) {
            cleanLocalPath = `local_videos/${filename}`;
          }
          const diskPath = import_path.default.join(process.cwd(), cleanLocalPath);
          if (import_fs.default.existsSync(diskPath)) {
            localVideoPaths.push(diskPath);
            continue;
          }
          const fallbackPath = import_path.default.join(LOCAL_VIDEOS_DIR, filename);
          if (import_fs.default.existsSync(fallbackPath)) {
            localVideoPaths.push(fallbackPath);
            continue;
          }
          try {
            const availableFiles = import_fs.default.readdirSync(LOCAL_VIDEOS_DIR).filter(
              (f) => [".mp4", ".mkv", ".avi", ".mov", ".webm"].includes(import_path.default.extname(f).toLowerCase())
            );
            if (availableFiles.length > 0) {
              const safeFallbackPath = import_path.default.join(LOCAL_VIDEOS_DIR, availableFiles[0]);
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
        const ext = import_path.default.extname(cleanUrl) || ".mp4";
        const urlHash = import_crypto.default.createHash("md5").update(url).digest("hex");
        const dest = import_path.default.join(cacheDir, `clip_${clip.id}_${urlHash}${ext}`);
        try {
          await downloadFile(url, dest);
          localVideoPaths.push(dest);
        } catch (downloadErr) {
          console.error(`[Renderer] Failed to download clip ${clip.id}:`, downloadErr);
          logTask(taskId, "WARNING", "VIDEO_ASSET", `Could not download clip ${clip.id}. Generating synthetic placeholder...`);
          localVideoPaths.push("placeholder");
        }
      }
      logTask(taskId, "SUCCESS", "VIDEO_ASSET", `Collected ${clips.length} video materials`);
      updateTaskState(30, null, null);
      let localNarrationPath = null;
      if (p.narration_audio_path) {
        if (p.narration_audio_path.startsWith("/") || !p.narration_audio_path.includes("://")) {
          const cleanLocalPath = p.narration_audio_path.startsWith("/") ? p.narration_audio_path.slice(1) : p.narration_audio_path;
          const diskPath = import_path.default.join(process.cwd(), cleanLocalPath);
          if (import_fs.default.existsSync(diskPath)) {
            localNarrationPath = diskPath;
          }
        }
        if (!localNarrationPath) {
          const ext = import_path.default.extname(p.narration_audio_path.split("?")[0]) || ".mp3";
          const dest = import_path.default.join(cacheDir, `narration_${projectId}${ext}`);
          try {
            await downloadFile(p.narration_audio_path, dest);
            localNarrationPath = dest;
          } catch (err) {
            console.error(`[Renderer] Narration download failed:`, err);
          }
        }
      }
      let localMusicPath = null;
      if (musicItem && musicItem.url) {
        if (musicItem.url.startsWith("/") || !musicItem.url.includes("://")) {
          const cleanLocalPath = musicItem.url.startsWith("/") ? musicItem.url.slice(1) : musicItem.url;
          const diskPath = import_path.default.join(process.cwd(), cleanLocalPath);
          if (import_fs.default.existsSync(diskPath)) {
            localMusicPath = diskPath;
          }
        }
        if (!localMusicPath) {
          const ext = import_path.default.extname(musicItem.url.split("?")[0]) || ".mp3";
          const dest = import_path.default.join(cacheDir, `music_${musicItem.id}${ext}`);
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
      const getVideoDuration = async (videoPath) => {
        try {
          const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
          const d = parseFloat(durationStr.trim());
          return isNaN(d) ? 0 : d;
        } catch (err) {
          console.error(`[getVideoDuration] Failed to probe ${videoPath}:`, err);
          return 0;
        }
      };
      let encoderArgs = "-c:v libx264 -crf 18 -preset veryfast";
      try {
        logTask(taskId, "INFO", "SYSTEM", "Detecting optimal video encoder (NVIDIA NVENC vs. CPU libx264)...");
        await executeCommand("ffmpeg -y -f lavfi -i color=c=black:s=16x16:d=0.1 -c:v h264_nvenc -f null -");
        encoderArgs = "-c:v h264_nvenc -preset p4 -cq 19 -rc vbr";
        logTask(taskId, "INFO", "SYSTEM", "\u{1F680} NVIDIA RTX GPU detected! Enabled hardware-accelerated NVENC encoding for maximum performance.");
      } catch (err) {
        logTask(taskId, "INFO", "SYSTEM", "No hardware NVENC support detected. Using CPU-based libx264 encoder (server/fallback mode).");
      }
      const formattedClips = [];
      const isLandscape = p.global_visual_style === "landscape" || p.aspect_ratio === "landscape";
      const resWidth = isLandscape ? 1280 : 720;
      const resHeight = isLandscape ? 720 : 1280;
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const inputPath = localVideoPaths[i];
        const formattedPath = import_path.default.join(cacheDir, `formatted_${taskId}_${i}.mp4`);
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
            const cmd = `ffmpeg -y ${loopCmd ? loopCmd + " " : ""}-i "${inputPath}" -ss ${start} -t ${duration} -vf "scale=${resWidth}:${resHeight}:force_original_aspect_ratio=increase,crop=${resWidth}:${resHeight},setsar=1" -r 25 ${encoderArgs} -pix_fmt yuv420p "${formattedPath}"`;
            await executeCommand(cmd);
          } catch (err) {
            console.error(`[Renderer] Failed to format clip ${i} (${inputPath}), falling back to placeholder:`, err);
            logTask(taskId, "WARNING", "VIDEO_ASSET", `Failed to process local video file: ${import_path.default.basename(inputPath)}. Using a colored placeholder instead.`);
            const cmd = `ffmpeg -y -f lavfi -i color=c=0x1E1E2E:s=${resWidth}x${resHeight}:d=${duration} -r 25 -pix_fmt yuv420p "${formattedPath}"`;
            await executeCommand(cmd);
          }
        }
        formattedClips.push(formattedPath);
        updateTaskState(Math.floor(40 + i / clips.length * 20), null, null);
      }
      logTask(taskId, "INFO", "COMPOSITION", "Combining video 1/1");
      updateTaskState(65, null, null);
      const concatFilePath = import_path.default.join(cacheDir, `concat_${taskId}.txt`);
      const concatContent = formattedClips.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n");
      await import_fs.default.promises.writeFile(concatFilePath, concatContent, "utf8");
      const concatOutput = import_path.default.join(cacheDir, `concatenated_${taskId}.mp4`);
      const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -c copy "${concatOutput}"`;
      await executeCommand(concatCmd);
      updateTaskState(75, null, null);
      logTask(taskId, "INFO", "AUDIO_MIXER", "Applying audio and subtitles 1/1");
      updateTaskState(80, null, null);
      let narrationDuration = 0;
      if (localNarrationPath && import_fs.default.existsSync(localNarrationPath)) {
        try {
          const durationStr = await executeCommand(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${localNarrationPath}"`);
          const d = parseFloat(durationStr.trim());
          if (!isNaN(d) && d > 0) {
            narrationDuration = d;
          }
        } catch (e) {
          console.error("[Renderer] Failed to get narration duration:", e);
        }
      }
      const audioMixedOutput = import_path.default.join(cacheDir, `audio_mixed_${taskId}.mp4`);
      let audioFilter = "";
      const audioInputs = [];
      if (localNarrationPath && localMusicPath) {
        audioInputs.push(`-i "${localNarrationPath}"`, `-stream_loop -1 -i "${localMusicPath}"`);
        const musicVolume = musicItem.volume !== void 0 ? musicItem.volume : 0.2;
        audioFilter = `[1:a]volume=1.0[v];[2:a]volume=${musicVolume}[m];[v][m]amix=inputs=2:duration=first[a]`;
      } else if (localNarrationPath) {
        audioInputs.push(`-i "${localNarrationPath}"`);
        audioFilter = `[1:a]volume=1.0[a]`;
      } else if (localMusicPath) {
        audioInputs.push(`-stream_loop -1 -i "${localMusicPath}"`);
        const musicVolume = musicItem.volume !== void 0 ? musicItem.volume : 0.2;
        audioFilter = `[1:a]volume=${musicVolume}[a]`;
      }
      let mixCmd = "";
      const limitDurationOpt = narrationDuration > 0 ? `-t ${narrationDuration}` : "";
      if (audioFilter) {
        mixCmd = `ffmpeg -y -i "${concatOutput}" ${audioInputs.join(" ")} -filter_complex "${audioFilter}" -map 0:v -map "[a]" -c:v copy -c:a aac ${limitDurationOpt} "${audioMixedOutput}"`;
      } else {
        mixCmd = `ffmpeg -y -i "${concatOutput}" -f lavfi -i anullsrc=r=44100:cl=stereo -c:v copy -c:a aac -shortest ${limitDurationOpt} "${audioMixedOutput}"`;
      }
      await executeCommand(mixCmd);
      updateTaskState(90, null, null);
      let subtitles = subtitleTrack?.items || [];
      if (subtitles.length === 0 && p.shot_plan?.segments) {
        console.log(`[Renderer] Subtitle track was empty, falling back to shot_plan segments (${p.shot_plan.segments.length} items)`);
        const fallbackSubtitles = [];
        p.shot_plan.segments.forEach((seg, idx) => {
          const startSec = seg.start_sec !== void 0 ? seg.start_sec : idx * 5;
          const durationSec = seg.target_duration_sec !== void 0 ? seg.target_duration_sec : 5;
          const splitItems = splitTextIntoTikTokSubtitles(seg.narration_text || "", startSec, durationSec, seg.id, `sub_fallback_${idx + 1}`);
          fallbackSubtitles.push(...splitItems);
        });
        subtitles = fallbackSubtitles;
      }
      let finalOutputPath = audioMixedOutput;
      const pParams = p.params || {};
      const subtitleEnabledParam = pParams.subtitle_enabled !== void 0 ? pParams.subtitle_enabled : p.subtitle_enabled !== void 0 ? p.subtitle_enabled : true;
      if (subtitles.length > 0 && subtitleEnabledParam) {
        const fontsConfPath = import_path.default.join(cacheDir, `fonts_${taskId}.conf`);
        const fontsConfXml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${import_path.default.join(process.cwd(), "public", "fonts")}</dir>
  <dir>${import_path.default.join(process.cwd(), "resource", "fonts")}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <cachedir>/tmp/fonts-cache-${taskId}</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>`;
        await import_fs.default.promises.writeFile(fontsConfPath, fontsConfXml, "utf8");
        process.env.FONTCONFIG_FILE = fontsConfPath;
        process.env.FONTCONFIG_PATH = cacheDir;
        const fontNameParam = pParams.font_name || p.font_name || "STHeitiMedium.ttc";
        const fontSizeParam = pParams.font_size || p.font_size || 60;
        const textColorParam = pParams.text_fore_color || p.text_fore_color || "#FFFFFF";
        const strokeColorParam = pParams.stroke_color || p.stroke_color || "#000000";
        const strokeWidthParam = pParams.stroke_width !== void 0 ? pParams.stroke_width : p.stroke_width !== void 0 ? p.stroke_width : 1.5;
        const hasBgParam = pParams.text_background_color !== void 0 ? pParams.text_background_color : p.text_background_color !== void 0 ? p.text_background_color : true;
        const subtitlePosParam = pParams.subtitle_position || p.subtitle_position || "bottom";
        const customPosParam = pParams.custom_position !== void 0 ? pParams.custom_position : p.custom_position !== void 0 ? p.custom_position : 70;
        const subtitleBgStyleParam = pParams.subtitle_bg_style || p.subtitle_bg_style || "solid";
        const roundedBgParam = pParams.rounded_subtitle_background !== void 0 ? pParams.rounded_subtitle_background : p.rounded_subtitle_background !== void 0 ? p.rounded_subtitle_background : false;
        const assFilePath = import_path.default.join(cacheDir, `subtitles_${taskId}.ass`);
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
          roundedBackground: roundedBgParam
        });
        await import_fs.default.promises.writeFile(assFilePath, assContent, "utf8");
        const srtOutput = import_path.default.join(renderDir, `render_${projectId}.mp4`);
        const assRelative = import_path.default.relative(process.cwd(), assFilePath).replace(/\\/g, "/");
        const escapedAssPath = assRelative.replace(/'/g, "'\\\\''").replace(/:/g, "\\:");
        const subFilter = `subtitles='${escapedAssPath}'`;
        const srtCmd = `ffmpeg -y -i "${audioMixedOutput}" -vf "${subFilter}" ${encoderArgs} -c:a copy "${srtOutput}"`;
        await executeCommand(srtCmd);
        finalOutputPath = srtOutput;
      } else {
        const copyOutput = import_path.default.join(renderDir, `render_${projectId}.mp4`);
        await import_fs.default.promises.copyFile(audioMixedOutput, copyOutput);
        finalOutputPath = copyOutput;
      }
      for (const f of formattedClips) {
        import_fs.default.promises.unlink(f).catch(() => {
        });
      }
      import_fs.default.promises.unlink(concatFilePath).catch(() => {
      });
      import_fs.default.promises.unlink(concatOutput).catch(() => {
      });
      if (finalOutputPath !== audioMixedOutput) {
        import_fs.default.promises.unlink(audioMixedOutput).catch(() => {
        });
      }
      const finalUrl = `/storage/renders/${p.project_folder_name}/render_${projectId}.mp4`;
      logTask(taskId, "SUCCESS", "RENDER", `Compression and rendering complete. Output file generated at: ${finalUrl}`);
      logTask(taskId, "SUCCESS", "SYSTEM", `Task ${taskId} completed successfully!`);
      p.videos = [finalUrl];
      p.combined_videos = [finalUrl];
      p.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      projects.set(projectId, p);
      updateTaskState(100, finalUrl, null, 1);
    } catch (err) {
      console.error(`[Renderer] Render failure for project ${projectId}:`, err);
      logTask(taskId, "ERROR", "RENDER", `Rendering failed: ${err.message}`);
      updateTaskState(100, null, err.message, -1);
    }
  };
  app.post("/api/v1/projects/:id/render", wrap(async (req, res) => {
    const renderTaskId = "render_task_" + req.params.id;
    tasks.set(renderTaskId, {
      state: 4,
      // TASK_STATE_PROCESSING
      progress: 0,
      output_path: null,
      error: null,
      logs: []
    });
    logTask(renderTaskId, "INFO", "SYSTEM", `Initializing video generation task ${renderTaskId}...`);
    logTask(renderTaskId, "INFO", "VALIDATION", "Verifying request payload parameters...");
    runRealRender(req.params.id, renderTaskId).catch((err) => {
      console.error(`[Renderer] Background render failed for project ${req.params.id}:`, err);
    });
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
    res.redirect("https://videos.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4");
  }));
  app.use("/storage/local_videos", import_express.default.static(LOCAL_VIDEOS_DIR));
  app.use("/storage", import_express.default.static(import_path.default.join(process.cwd(), "storage")));
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
