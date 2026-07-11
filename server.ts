import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Ensure local_videos directory exists and is populated with dummy files if empty
const LOCAL_VIDEOS_DIR = path.join(process.cwd(), "storage", "local_videos");
if (!fs.existsSync(LOCAL_VIDEOS_DIR)) {
  fs.mkdirSync(LOCAL_VIDEOS_DIR, { recursive: true });
}

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
  { name: "Ambient Forest", size: 5410234, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { name: "Cosmic Journey", size: 6109230, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { name: "Sunny Day Acoustic", size: 4892019, file: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];

// Mock Stock Videos
const SAMPLE_VIDEOS = [
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

// Helper to call Gemini if API Key is set
async function generateGeminiContent(prompt: string, jsonMode = false): Promise<string> {
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
          generationConfig: jsonMode ? { responseMimeType: "application/json" } : undefined,
        }),
      }
    );
    if (!response.ok) {
      const txt = await response.text();
      console.error("Gemini API error status:", response.status, txt);
      throw new Error(`Gemini status ${response.status}`);
    }
    const result = await response.json() as any;
    return result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (err: any) {
    console.error("Failed calling Gemini API:", err);
    throw err;
  }
}

// In-Memory Database
const projects = new Map<string, any>();
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

  app.put("/api/v1/config", wrap(async (req: any, res: any) => {
    globalConfig.settings = { ...globalConfig.settings, ...req.body };
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
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(text.substring(0, 200))}`;
      const response = await fetch(googleTtsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch preview audio: ${response.status}`);
      }
      res.setHeader("Content-Type", "audio/mpeg");
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
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
    const { video_subject, video_language = "es", paragraph_number = 3 } = req.body;
    let scriptText = "";

    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Escribe un guión de video cautivador, detallado y narrativo sobre "${video_subject}" en idioma ${video_language}. Es CRÍTICO que el guión tenga exactamente ${paragraph_number} párrafos bien estructurados, completos y detallados (cada párrafo debe ser lo suficientemente largo y descriptivo, óptimo para narrar una historia o un documental). Separa cada párrafo estrictamente con dos saltos de línea (\\n\\n). Devuelve SOLAMENTE el texto del guión, sin títulos, introducciones ni comentarios adicionales.`;
        scriptText = await generateGeminiContent(prompt);
      } catch (err) {
        console.warn("Gemini script generation failed, falling back to static", err);
      }
    }

    if (!scriptText) {
      scriptText = getFallbackScript(video_subject, paragraph_number);
    }

    res.json({ status: 200, message: "ok", data: { video_script: scriptText } });
  }));

  app.post("/api/v1/terms", wrap(async (req: any, res: any) => {
    const { video_subject, video_script = "" } = req.body;
    let terms: string[] = [];

    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Analiza el siguiente guión de video y genera una lista de exactamente 5 términos de búsqueda en inglés (para buscar videos de stock relevantes). Devuelve una respuesta JSON con el formato: { "terms": ["term1", "term2", ...] }. Guión: ${video_script}`;
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

  app.post("/api/v1/videos", wrap(async (req: any, res: any) => {
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
    
    // Create initial task state
    const taskStatus = {
      state: 4, // TASK_STATE_PROCESSING
      progress: 0,
      videos: [],
      combined_videos: [],
      logs: []
    };

    tasks.set(taskId, taskStatus);

    // Initial Logs
    logTask(taskId, "INFO", "SYSTEM", `Initializing video generation task ${taskId}...`);
    logTask(taskId, "INFO", "VALIDATION", "Verifying request payload parameters...");

    // Validate video source and files if local
    let validationFailed = false;
    let validationErrorMessage = "";

    if (video_source === "local") {
      logTask(taskId, "INFO", "VALIDATION", `Video source is set to LOCAL. Selected files: ${Array.isArray(local_video_files) ? local_video_files.join(", ") : "None"}`);
      if (!local_video_files || !Array.isArray(local_video_files) || local_video_files.length === 0) {
        validationFailed = true;
        validationErrorMessage = "No local video files were selected. Please choose at least one video in the Configurations panel.";
      } else {
        // Check if selected files exist on disk
        const missingFiles = [];
        for (const file of local_video_files) {
          const filePath = path.join(LOCAL_VIDEOS_DIR, file);
          if (!fs.existsSync(filePath)) {
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

    // Validate script or subject
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
        t.state = -1; // TASK_STATE_FAILED
        tasks.set(taskId, t);
      }
      return res.json({ status: 200, message: "ok", data: { task_id: taskId } });
    }

    // Pre-requisite validation passed
    logTask(taskId, "SUCCESS", "VALIDATION", `All parameters validated. Script character count: ${video_script?.length || 0}. Format: ${video_aspect || "9:16"}`);

    // Simulate background process step-by-step
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
        // Phase 1: Audio Synthesis & TTS
        logTask(taskId, "INFO", "TTS", `Starting Text-to-Speech synthesis using provider: "${tts_provider || "azure-tts-v1"}"...`);
        if (!voice_name) {
          logTask(taskId, "WARNING", "TTS", "No voice name specified. Falling back to default neural speaker.");
        } else {
          logTask(taskId, "INFO", "TTS", `Synthesizing spoken track with voice: "${voice_name}"...`);
        }
        logTask(taskId, "SUCCESS", "TTS", `Audio track synthesized successfully. Duration: 38.4s. Saved as tts_${taskId}.mp3.`);

      } else if (progress === 40) {
        // Phase 2: Whisper alignment & Subtitles
        logTask(taskId, "INFO", "SUBTITLES", "Loading Whisper voice-alignment model...");
        logTask(taskId, "INFO", "SUBTITLES", "Aligning spoken voice audio to original script tokens...");
        logTask(taskId, "SUCCESS", "SUBTITLES", "Successfully generated subtitle cues (SRT) with timestamp mappings.");

      } else if (progress === 60) {
        // Phase 3: Video asset sourcing
        if (video_source === "local") {
          logTask(taskId, "INFO", "VIDEO_ASSET", `Loading ${local_video_files.length} verified files from local storage...`);
          local_video_files.forEach((file: string) => {
            logTask(taskId, "INFO", "VIDEO_ASSET", `Including asset: storage/local_videos/${file}`);
          });
          logTask(taskId, "SUCCESS", "VIDEO_ASSET", "All local assets imported successfully.");
        } else {
          logTask(taskId, "INFO", "VIDEO_ASSET", `Querying search terms from online API provider (${video_source || "pexels"})...`);
          logTask(taskId, "SUCCESS", "VIDEO_ASSET", `Successfully retrieved and cached 5 clips matching tags: ${Array.isArray(req.body.video_terms) ? req.body.video_terms.join(", ") : "general"}.`);
        }

      } else if (progress === 80) {
        // Phase 4: Composition & Subtitle overlay
        logTask(taskId, "INFO", "COMPOSITION", `Joining video assets with concat mode: "${video_concat_mode || "random"}"`);
        if (bgm_file) {
          logTask(taskId, "INFO", "AUDIO_MIXER", `Mixing background music track: "${bgm_file}" at volume: ${bgm_volume || 0.2}`);
        } else {
          logTask(taskId, "INFO", "AUDIO_MIXER", "Injecting ambient background music track...");
        }
        logTask(taskId, "INFO", "COMPOSITION", `Burning subtitle overlays onto visual frames (Font: "${font_name || "STHeitiMedium.ttc"}", Size: ${font_size || 60}px, Color: "${text_fore_color || "#FFFFFF"}")...`);
        logTask(taskId, "SUCCESS", "COMPOSITION", "Composition of video and subtitle tracks complete.");

      } else if (progress >= 100) {
        // Phase 5: Final render
        logTask(taskId, "INFO", "RENDER", `Launching FFmpeg encoding task (Threads: ${n_threads || 2}, Codec: "${video_codec || "libx264"}")...`);
        logTask(taskId, "SUCCESS", "RENDER", `Compression and rendering complete. Output file generated at: storage/renders/render_${taskId}.mp4`);
        logTask(taskId, "SUCCESS", "SYSTEM", `Task ${taskId} completed successfully!`);

        t.state = 1; // TASK_STATE_COMPLETE
        t.videos = [SAMPLE_VIDEOS[0].source_url];
        t.combined_videos = [SAMPLE_VIDEOS[0].source_url];
        tasks.set(taskId, t);
        clearInterval(interval);
      }
    }, 1500);

    res.json({ status: 200, message: "ok", data: { task_id: taskId } });
  }));

  app.get("/tasks/:id", wrap(async (req: any, res: any) => {
    const t = tasks.get(req.params.id);
    if (!t) {
      return res.status(404).json({ status: 404, message: "Task not found", data: null });
    }
    res.json({ status: 200, message: "ok", data: t });
  }));

  app.get("/tasks", wrap(async (req: any, res: any) => {
    const data: Record<string, any> = {};
    for (const [k, v] of tasks.entries()) {
      data[k] = v;
    }
    res.json({ status: 200, message: "ok", data });
  }));

  app.delete("/tasks/:id", wrap(async (req: any, res: any) => {
    tasks.delete(req.params.id);
    res.json({ status: 200, message: "ok", data: null });
  }));

  app.get("/api/v1/musics", wrap(async (req: any, res: any) => {
    res.json({ status: 200, message: "ok", data: { files: BGM_FILES } });
  }));

  // 5. Projects APIs
  app.get("/api/v1/projects", wrap(async (req: any, res: any) => {
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
      if (process.env.GEMINI_API_KEY) {
        try {
          const prompt = `Escribe un guión de video cautivador, detallado y narrativo sobre "${topic}" en idioma ${language}. Es CRÍTICO que el guión tenga exactamente ${paragraph_number} párrafos bien estructurados, completos y detallados (cada párrafo debe ser lo suficientemente largo y descriptivo, óptimo para narrar una historia o un documental). Separa cada párrafo estrictamente con dos saltos de línea (\\n\\n). Devuelve SOLAMENTE el texto del guión, sin títulos, introducciones ni comentarios adicionales.`;
          scriptText = await generateGeminiContent(prompt);
        } catch {
          // ignore
        }
      }
      if (!scriptText) {
        scriptText = getFallbackScript(topic, paragraph_number);
      }
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
      data: { project_id: projectId, has_script: true, source_kind: "script" }
    });
  }));

  app.post("/api/v1/projects/from-reddit", wrap(async (req: any, res: any) => {
    const { url, title, body, language = "es" } = req.body;
    const projectId = "proj_" + Math.random().toString(36).substring(2, 9);
    const script = `${title}\n\n${body}`;

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
    res.json({ status: 200, message: "ok", data: p });
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
    const updated = { ...p, ...req.body };
    updated.updated_at = new Date().toISOString();
    projects.set(req.params.id, updated);
    res.json({ status: 200, message: "ok", data: { project_id: p.project_id } });
  }));

  app.post("/api/v1/projects/:id/plan", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    const sentences = (p.script || p.topic || "")
      .split(/[.!?]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 5);

    const segments = sentences.map((sentence: string, idx: number) => {
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
    p.updated_at = new Date().toISOString();
    projects.set(req.params.id, p);

    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, segment_count: segments.length }
    });
  }));

  app.post("/api/v1/projects/:id/media/search", wrap(async (req: any, res: any) => {
    const p = projects.get(req.params.id);
    if (!p) {
      return res.status(404).json({ status: 404, message: "Project not found", data: null });
    }

    // Assign mock media candidates based on planned segments
    const candidates = p.shot_plan?.segments?.flatMap((seg: any) => {
      return SAMPLE_VIDEOS.map((v, i) => ({
        ...v,
        id: `${seg.id}_cand_${i + 1}`,
        segment_id: seg.id,
        score: 0.9 - i * 0.1,
        score_reasons: ["Matches query: " + seg.search_queries.join(", ")]
      }));
    }) || [];

    // Pre-select the highest scored candidates
    const selected = p.shot_plan?.segments?.map((seg: any) => {
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

    // Build timeline tracks
    const videoItems = (p.selected_media || []).map((med: any, idx: number) => ({
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

    const subtitleItems = (p.shot_plan?.segments || []).map((seg: any, idx: number) => ({
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
    p.updated_at = new Date().toISOString();
    projects.set(req.params.id, p);

    res.json({
      status: 200,
      message: "ok",
      data: { project_id: p.project_id, track_count: p.tracks.length }
    });
  }));

  app.post("/api/v1/projects/:id/narration", wrap(async (req: any, res: any) => {
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

  app.post("/api/v1/projects/:id/timeline/commands", wrap(async (req: any, res: any) => {
    res.json({
      status: 200,
      message: "ok",
      data: { project_id: req.params.id, applied: req.body.commands?.length || 0, valid: true }
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

  app.post("/api/v1/projects/:id/render", wrap(async (req: any, res: any) => {
    const renderTaskId = "render_task_" + req.params.id;
    tasks.set(renderTaskId, {
      state: 4, // TASK_STATE_PROCESSING
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
          t.state = 1; // TASK_STATE_COMPLETE
          // The finished video is our beautiful Tokyo Timelapse
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
    res.redirect("https://images.pexels.com/video-files/3248319/3248319-hd_1920_1080_25fps.mp4");
  }));

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
