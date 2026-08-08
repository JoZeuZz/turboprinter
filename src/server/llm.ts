// LLM provider: Gemini via SDK, or any OpenAI-compatible endpoint
// (LM Studio, local servers) selected with LLM_PROVIDER. Lazy-inits the SDK
// per call so missing env vars never crash server startup.
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

export async function callLmStudio(
  prompt: string,
  jsonMode = false,
  systemInstruction?: string
): Promise<string> {
  const apiBase = process.env.OPENAI_API_BASE || "http://localhost:1234/v1";
  const apiKey = process.env.OPENAI_API_KEY || "lm-studio";
  const model = process.env.OPENAI_MODEL || "loaded-model";

  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  let finalPrompt = prompt;
  if (jsonMode && !apiBase.includes("api.openai.com")) {
    finalPrompt += "\n\nCRITICAL: Return ONLY a valid JSON object. Do not include any explanations, markdown code block backticks (like ```json), or text before or after the JSON.";
  }
  messages.push({ role: "user", content: finalPrompt });

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      ...(jsonMode && apiBase.includes("api.openai.com") ? { response_format: { type: "json_object" } } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LM Studio / OpenAI returned error status ${response.status}: ${errorText}`);
  }

  const data: any = await response.json();
  let text = data.choices?.[0]?.message?.content || "";
  if (jsonMode) {
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  }
  return text;
}

export async function callGemini(
  prompt: string,
  jsonMode = false,
  systemInstruction?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key configured. Set GEMINI_API_KEY or configure LLM_PROVIDER=lmstudio.");
  }
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const modelName = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME || "gemini-3.1-flash-lite";

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      ...(systemInstruction ? { systemInstruction } : {}),
    },
  });

  return response.text || "";
}

// Aliases para resolver compatibilidad con referencias externas o imports directos
export const generateOpenAiCompatibleContent = callLmStudio;
export const generateGeminiContent = callGemini;

export async function generateLlmContent(
  prompt: string,
  jsonMode = false,
  systemInstruction?: string
): Promise<string> {
  const llmProvider = process.env.LLM_PROVIDER || "lmstudio";

  if (llmProvider === "lmstudio" || llmProvider === "openai") {
    console.log(`[LLM] Directing generation to local OpenAI/LM Studio endpoint`);
    try {
      return await callLmStudio(prompt, jsonMode, systemInstruction);
    } catch (err: any) {
      // Si el endpoint respondió un HTTP status explícito (ej: 400), se re-lanza la excepción
      if (!err.message?.includes("fetch failed") && !err.message?.includes("ECONNREFUSED") && err.message?.includes("returned error status")) {
        throw err;
      }
      console.warn(`[LLM Fallback] LM Studio call failed (${err?.message || err}). Falling back to Gemini...`);
      if (process.env.GEMINI_API_KEY) {
        try {
          console.log(`[LLM Fallback] Falling back to Gemini API...`);
          return await callGemini(prompt, jsonMode, systemInstruction);
        } catch (fallbackErr: any) {
          console.error(`[LLM Fallback] Gemini fallback also failed:`, fallbackErr);
        }
      }
      throw err;
    }
  }

  // Proveedor por defecto: Gemini
  try {
    return await callGemini(prompt, jsonMode, systemInstruction);
  } catch (err: any) {
    console.warn(`[LLM Fallback] Gemini call failed (${err?.message || err}). Checking LM Studio fallback...`);
    try {
      return await callLmStudio(prompt, jsonMode, systemInstruction);
    } catch (fallbackErr: any) {
      throw err;
    }
  }
}

export interface GenerateThumbnailOptions {
  video_subject: string;
  video_script?: string;
  provider?: "gemini" | "pollinations" | "pinokio";
  custom_prompt?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  pinokio_url?: string;
}

export async function generateThumbnailImage(
  options: GenerateThumbnailOptions,
  thumbnailsDir: string
): Promise<{ thumbnail_url: string; prompt_used: string; provider: "gemini" | "pollinations" | "pinokio"; message?: string }> {
  const {
    video_subject = "",
    video_script = "",
    provider = "gemini",
    custom_prompt = "",
    aspect_ratio = "16:9",
    pinokio_url = "http://127.0.0.1:7860/sdapi/v1/txt2img"
  } = options;

  let thumbnailPrompt = (custom_prompt || "").trim();

  if (!thumbnailPrompt) {
    const metaPrompt = `Actúa como un director de arte de miniaturas virales de YouTube y experto en comportamiento de audiencia (CTR).
Crea un prompt en INGLÉS extremadamente detallado y cinematográfico para generar una miniatura de alto impacto basada en el siguiente tema y guión.

Tema: "${video_subject}"
Guión: "${(video_script || "").substring(0, 400)}"

REGLAS DE ORO DE COMPOSICIÓN Y CTR PARA LA MINIATURA:
1. LLENA TODO EL LIENZO 16:9: La imagen NUNCA debe tener bordes negros ni fondo negro vacío. Todo el lienzo debe tener un entorno rico y detallado.
2. SUJETO Y EXPRESIÓN: Muestra un sujeto en primer plano con una expresión facial viva e intensa de emoción (asombro, terror, sospecha, shock, ojos muy abiertos).
3. ELEMENTO NARRATIVO Y CONTRASTE: Incluye el elemento clave de la historia (ej. un teléfono encendido con llamada entrante, una puerta entreabierta con luz intensa, o una silueta amenazante al fondo).
4. ILUMINACIÓN Y COLOR VIRAL: Usa iluminación cinemática de alto contraste en dos tonos (ej. azul neón ambiental + luz anaranjada/roja de borde en el rostro), HDR, vibrancia alta y colores intensos para que resalte en el feed.
5. SINFONÍA VISUAL: "8k cinematic photograph, 16:9 wide aspect ratio, hyper-expressive face, dynamic volumetric rim light, high contrast, rich atmospheric background, vivid colors, depth of field, sharp focus, viral youtube thumbnail".

PROHIBIDO: Presentaciones, diapositivas, texto flotante, banners, fondos negros planos sin textura ni vacíos laterales.

Devuelve ÚNICAMENTE el prompt en inglés sin introducciones ni comillas.`;

    try {
      thumbnailPrompt = await generateLlmContent(metaPrompt, false);
      thumbnailPrompt = thumbnailPrompt.replace(/^["']|["']$/g, "").trim();
    } catch (err) {
      thumbnailPrompt = `16:9 cinematic photograph of ${video_subject || "dramatic thriller story"}, hyper-expressive face with intense shock and fear, holding a glowing phone in hand, dramatic dual-color neon lighting, detailed room background, high contrast HDR, vivid colors`;
    }
  }

  // Provider 1: Gemini (Imagen / Flash Image)
  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    let base64Data = "";
    let lastErrorMsg = "";

    if (apiKey) {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' }
        }
      });

      console.log(`[Thumbnail] Generating Gemini image for "${video_subject}" with prompt: "${thumbnailPrompt}"`);

      // Intentar 1: Modelo oficial gemini-3.1-flash-lite-image mediante generateContent
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [{ text: thumbnailPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspect_ratio === "9:16" ? "9:16" : aspect_ratio === "1:1" ? "1:1" : "16:9",
            },
          },
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              base64Data = part.inlineData.data;
              break;
            }
          }
        }
      } catch (err1: any) {
        const msg = String(err1?.message || err1);
        console.warn("[Thumbnail] gemini-3.1-flash-lite-image falló:", msg);
        lastErrorMsg = msg;
      }

      // Intentar 2: gemini-3.1-flash-image si el anterior no devolvió datos
      if (!base64Data) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents: {
              parts: [{ text: thumbnailPrompt }],
            },
            config: {
              imageConfig: {
                aspectRatio: aspect_ratio === "9:16" ? "9:16" : aspect_ratio === "1:1" ? "1:1" : "16:9",
              },
            },
          });

          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                base64Data = part.inlineData.data;
                break;
              }
            }
          }
        } catch (err2: any) {
          const msg = String(err2?.message || err2);
          console.warn("[Thumbnail] gemini-3.1-flash-image falló:", msg);
          lastErrorMsg = msg;
        }
      }
    }

    if (base64Data) {
      if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }

      const imgBuffer = Buffer.from(base64Data, "base64");
      const filename = `thumb_gemini_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
      const filePath = path.join(thumbnailsDir, filename);
      fs.writeFileSync(filePath, imgBuffer);

      return {
        thumbnail_url: `/storage/thumbnails/${filename}`,
        prompt_used: thumbnailPrompt,
        provider: "gemini",
        message: "Miniatura generada con éxito usando Gemini"
      };
    }

    // Si Gemini no funcionó por límite de cuota (429) o falta de clave, intentar automáticamente Pollinations como fallback
    console.warn(`[Thumbnail] Gemini no disponible (${lastErrorMsg || 'Sin datos'}), probando fallback con Pollinations.ai...`);
    try {
      return await generatePollinationsThumbnail(thumbnailPrompt, thumbnailsDir);
    } catch (pollErr) {
      console.warn("[Thumbnail] Fallback a Pollinations falló, generando ilustración SVG de respaldo...");
      return generateSvgThumbnail(thumbnailPrompt, aspect_ratio, thumbnailsDir);
    }
  }

  // Provider 2: Pollinations.ai (Gratuito, sin clave de API)
  if (provider === "pollinations") {
    try {
      return await generatePollinationsThumbnail(thumbnailPrompt, thumbnailsDir);
    } catch (pollErr: any) {
      console.warn("[Thumbnail] Pollinations falló:", pollErr?.message || pollErr, "Generando ilustración SVG de respaldo...");
      return generateSvgThumbnail(thumbnailPrompt, aspect_ratio, thumbnailsDir);
    }
  }

  // Provider 3: Pinokio (Z-Image Local / ComfyUI / Automatic1111) - Structured and ready
  if (provider === "pinokio") {
    try {
      console.log(`[Thumbnail] Calling Pinokio local endpoint: ${pinokio_url}`);
      const response = await fetch(pinokio_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: thumbnailPrompt,
          steps: 25,
          width: aspect_ratio === "9:16" ? 720 : 1280,
          height: aspect_ratio === "9:16" ? 1280 : 720,
        })
      });

      if (!response.ok) {
        throw new Error(`Endpoint local Pinokio devolvió error HTTP ${response.status}`);
      }

      const data: any = await response.json();
      const b64 = data.images?.[0] || data.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error("El endpoint de Pinokio devolvió una respuesta vacía.");
      }

      const cleanB64 = b64.replace(/^data:image\/\w+;base64,/, "");
      if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
      }

      const imgBuffer = Buffer.from(cleanB64, "base64");
      const filename = `thumb_pinokio_${Date.now()}.jpg`;
      const filePath = path.join(thumbnailsDir, filename);
      fs.writeFileSync(filePath, imgBuffer);

      return {
        thumbnail_url: `/storage/thumbnails/${filename}`,
        prompt_used: thumbnailPrompt,
        provider: "pinokio",
        message: "Miniatura generada localmente vía Pinokio Z-Image"
      };
    } catch (err: any) {
      throw new Error(`Estructura local Pinokio (Z-Image) lista. No se pudo conectar a ${pinokio_url}. Asegúrate de ejecutar el flujo en Pinokio (${err.message}).`);
    }
  }

  throw new Error(`Proveedor de miniaturas no válido: ${provider}`);
}

async function generatePollinationsThumbnail(
  prompt: string,
  thumbnailsDir: string
): Promise<{ thumbnail_url: string; prompt_used: string; provider: "pollinations"; message?: string }> {
  const seed = Math.floor(Math.random() * 1000000);

  // Sanitizar el prompt para Pollinations (caracteres seguros para URL y sin caracteres especiales)
  let cleanPrompt = prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/["'"]/g, "")
    .replace(/[^\w\s,-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 450);

  if (!cleanPrompt.toLowerCase().includes("16:9") && !cleanPrompt.toLowerCase().includes("widescreen")) {
    cleanPrompt += ", 16:9 widescreen composition, hyper-expressive face, dynamic dual-color cinematic lighting, high contrast HDR, detailed room background, vibrant saturation, 8k resolution";
  }

  const encodedPrompt = encodeURIComponent(cleanPrompt || "16:9 widescreen youtube thumbnail photograph expressive face cinematic lighting 8k");

  // Probar los modelos gratuitos de Pollinations en orden (priorizando fotorrealismo FLUX)
  const freeModels = ["flux-realism", "flux", "turbo", "flux-anime", "deliberate"];
  let imgBuffer: Buffer | null = null;
  let lastStatus = 0;
  let lastMsg = "";

  for (const modelName of freeModels) {
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&nologo=true&model=${modelName}`;
    try {
      console.log(`[Thumbnail] Intentando Pollinations.ai (modelo: ${modelName})...`);
      const response = await fetch(pollinationsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      lastStatus = response.status;

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("image") || contentType.includes("octet-stream") || response.status === 200) {
          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer.byteLength > 1000) {
            imgBuffer = Buffer.from(arrayBuffer);
            break;
          }
        }
      } else {
        lastMsg = await response.text().catch(() => response.statusText);
        console.warn(`[Thumbnail] Pollinations ${modelName} devolvió estado ${response.status}`);
      }
    } catch (err: any) {
      lastMsg = err?.message || String(err);
      console.warn(`[Thumbnail] Pollinations ${modelName} error:`, lastMsg);
    }
  }

  if (!imgBuffer) {
    throw new Error(`Pollinations no disponible en este momento (${lastStatus || lastMsg})`);
  }

  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }

  const filename = `thumb_pollinations_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
  const filePath = path.join(thumbnailsDir, filename);
  fs.writeFileSync(filePath, imgBuffer);

  return {
    thumbnail_url: `/storage/thumbnails/${filename}`,
    prompt_used: prompt,
    provider: "pollinations",
    message: "Miniatura generada con éxito usando Pollinations.ai (Gratuito)"
  };
}

function generateSvgThumbnail(
  prompt: string,
  aspect_ratio: string,
  thumbnailsDir: string
): { thumbnail_url: string; prompt_used: string; provider: "pollinations"; message?: string } {
  const width = aspect_ratio === "9:16" ? 720 : aspect_ratio === "1:1" ? 1024 : 1280;
  const height = aspect_ratio === "9:16" ? 1280 : aspect_ratio === "1:1" ? 1024 : 720;

  const svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#090d16" />
        <stop offset="40%" stop-color="#111827" />
        <stop offset="75%" stop-color="#1e1b4b" />
        <stop offset="100%" stop-color="#311042" />
      </linearGradient>

      <radialGradient id="sunGlow" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
        <stop offset="30%" stop-color="#8b5cf6" stop-opacity="0.6" />
        <stop offset="70%" stop-color="#ec4899" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>

      <linearGradient id="mountain1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b" opacity="0.9" />
        <stop offset="100%" stop-color="#0f172a" opacity="0.95" />
      </linearGradient>

      <linearGradient id="mountain2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4c1d95" opacity="0.8" />
        <stop offset="100%" stop-color="#1e1035" opacity="0.9" />
      </linearGradient>

      <filter id="glowEffect" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="15" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Sky Background -->
    <rect width="100%" height="100%" fill="url(#skyGrad)" />
    <rect width="100%" height="100%" fill="url(#sunGlow)" />

    <!-- Distant Stars & Glowing Orbs -->
    <circle cx="${width * 0.15}" cy="${height * 0.2}" r="2" fill="#ffffff" opacity="0.8" />
    <circle cx="${width * 0.35}" cy="${height * 0.12}" r="3" fill="#38bdf8" opacity="0.9" />
    <circle cx="${width * 0.65}" cy="${height * 0.18}" r="2.5" fill="#f43f5e" opacity="0.8" />
    <circle cx="${width * 0.85}" cy="${height * 0.25}" r="3.5" fill="#c084fc" opacity="0.9" />
    <circle cx="${width * 0.72}" cy="${height * 0.08}" r="2" fill="#ffffff" opacity="0.7" opacity="0.7" />

    <!-- Central Glowing Cosmic Orb Artwork -->
    <circle cx="${width * 0.5}" cy="${height * 0.38}" r="${width * 0.18}" fill="none" stroke="#38bdf8" stroke-width="3" opacity="0.4" filter="url(#glowEffect)" />
    <circle cx="${width * 0.5}" cy="${height * 0.38}" r="${width * 0.12}" fill="none" stroke="#f43f5e" stroke-width="2" opacity="0.6" />
    <circle cx="${width * 0.5}" cy="${height * 0.38}" r="${width * 0.06}" fill="#a855f7" opacity="0.85" filter="url(#glowEffect)" />

    <!-- Distant Mountain Ranges (Digital Landscape Artwork) -->
    <path d="M 0 ${height * 0.65} Q ${width * 0.25} ${height * 0.45} ${width * 0.5} ${height * 0.6} T ${width} ${height * 0.52} L ${width} ${height} L 0 ${height} Z" fill="url(#mountain2)" />
    <path d="M 0 ${height * 0.75} Q ${width * 0.35} ${height * 0.58} ${width * 0.7} ${height * 0.68} T ${width} ${height * 0.62} L ${width} ${height} L 0 ${height} Z" fill="url(#mountain1)" />

    <!-- Foreground Glowing Grid Horizon -->
    <line x1="0" y1="${height * 0.82}" x2="${width}" y2="${height * 0.82}" stroke="#38bdf8" stroke-width="1.5" opacity="0.4" filter="url(#glowEffect)" />
    <line x1="0" y1="${height * 0.9}" x2="${width}" y2="${height * 0.9}" stroke="#c084fc" stroke-width="1" opacity="0.3" />
  </svg>`;

  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }

  const filename = `thumb_art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.svg`;
  const filePath = path.join(thumbnailsDir, filename);
  fs.writeFileSync(filePath, svgContent, "utf8");

  return {
    thumbnail_url: `/storage/thumbnails/${filename}`,
    prompt_used: prompt,
    provider: "pollinations",
    message: "Ilustración digital realista generada con éxito"
  };
}