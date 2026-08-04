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
    const metaPrompt = `Actúa como un diseñador gráfico profesional experto en crear miniaturas virales y atractivas para YouTube y redes sociales.
Crea un prompt en INGLÉS detallado y muy descriptivo para generar una imagen de miniatura de alta calidad basada en el siguiente tema y guión.

Tema: "${video_subject}"
Guión: "${(video_script || "").substring(0, 400)}"

Pautas para el prompt de la miniatura:
- Describe una escena dramática, de alto impacto visual, con iluminación cinematográfica y elementos llamativos.
- Especifica el estilo visual (ej: "cinematic 4k photograph", "dramatic lighting", "vibrant colors", "hyperrealistic", "mysterious mood").
- Muestra el concepto principal sin texto distorsionado.

Devuelve ÚNICAMENTE el prompt en inglés sin introducciones ni comillas.`;

    try {
      thumbnailPrompt = await generateLlmContent(metaPrompt, false);
      thumbnailPrompt = thumbnailPrompt.replace(/^["']|["']$/g, "").trim();
    } catch (err) {
      thumbnailPrompt = `Cinematic 4k photograph YouTube thumbnail for topic: ${video_subject || "mysterious story"}, high contrast, dramatic lighting, detailed, photorealistic`;
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
      console.warn("[Thumbnail] Fallback a Pollinations falló, generando miniatura gráfica SVG local...");
      return generateSvgThumbnail(video_subject, thumbnailPrompt, aspect_ratio, thumbnailsDir);
    }
  }

  // Provider 2: Pollinations.ai (Gratuito, sin clave de API)
  if (provider === "pollinations") {
    try {
      return await generatePollinationsThumbnail(thumbnailPrompt, thumbnailsDir);
    } catch (pollErr: any) {
      console.warn("[Thumbnail] Pollinations falló:", pollErr?.message || pollErr, "Generando miniatura gráfica SVG local...");
      return generateSvgThumbnail(video_subject, thumbnailPrompt, aspect_ratio, thumbnailsDir);
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
  const cleanPrompt = prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/["'"]/g, "")
    .replace(/[^\w\s,-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 180);

  const encodedPrompt = encodeURIComponent(cleanPrompt || "youtube thumbnail cinematic high contrast");

  // Probar los modelos gratuitos de Pollinations en orden
  const freeModels = ["flux", "turbo", "flux-realism", "flux-anime", "deliberate"];
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
  subject: string,
  prompt: string,
  aspect_ratio: string,
  thumbnailsDir: string
): { thumbnail_url: string; prompt_used: string; provider: "pollinations"; message?: string } {
  const width = aspect_ratio === "9:16" ? 720 : aspect_ratio === "1:1" ? 1024 : 1280;
  const height = aspect_ratio === "9:16" ? 1280 : aspect_ratio === "1:1" ? 1024 : 720;

  const displayTitle = (subject || "NUEVO VIDEO").toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÑ\s]/gi, "");
  const wordParts = displayTitle.split(" ");
  const line1 = wordParts.slice(0, Math.ceil(wordParts.length / 2)).join(" ") || "MINIATURA HD";
  const line2 = wordParts.slice(Math.ceil(wordParts.length / 2)).join(" ") || "EXCLUSIVO";

  const svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="50%" stop-color="#1e1b4b" />
        <stop offset="100%" stop-color="#311042" />
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f43f5e" />
        <stop offset="100%" stop-color="#8b5cf6" />
      </linearGradient>
      <radialGradient id="glowGrad" cx="75%" cy="25%" r="65%">
        <stop offset="0%" stop-color="#ec4899" stop-opacity="0.45" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
      <filter id="shadowFilter" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.85"/>
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#bgGrad)" />
    <rect width="100%" height="100%" fill="url(#glowGrad)" />

    <circle cx="${width * 0.82}" cy="${height * 0.28}" r="${width * 0.25}" fill="none" stroke="url(#accentGrad)" stroke-width="4" opacity="0.35" />
    <circle cx="${width * 0.82}" cy="${height * 0.28}" r="${width * 0.16}" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.45" />

    <rect x="${width * 0.07}" y="${height * 0.22}" width="16" height="${height * 0.5}" rx="8" fill="url(#accentGrad)" />

    <rect x="${width * 0.1}" y="${height * 0.22}" width="200" height="42" rx="21" fill="#f43f5e" />
    <text x="${width * 0.1 + 100}" y="${height * 0.22 + 27}" font-family="system-ui, sans-serif" font-weight="800" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">MÁXIMA CALIDAD</text>

    <g filter="url(#shadowFilter)">
      <text x="${width * 0.1}" y="${height * 0.42}" font-family="system-ui, sans-serif" font-weight="900" font-size="${aspect_ratio === "9:16" ? 48 : 64}" fill="#ffffff">${line1.substring(0, 24)}</text>
      <text x="${width * 0.1}" y="${height * 0.55}" font-family="system-ui, sans-serif" font-weight="900" font-size="${aspect_ratio === "9:16" ? 48 : 64}" fill="#38bdf8">${line2.substring(0, 24)}</text>
    </g>

    <rect x="${width * 0.1}" y="${height * 0.65}" width="${width * 0.45}" height="56" rx="12" fill="#000000" opacity="0.65" />
    <text x="${width * 0.12}" y="${height * 0.65 + 35}" font-family="system-ui, sans-serif" font-weight="700" font-size="20" fill="#e2e8f0" letter-spacing="0.5">EDICIÓN ESPECIAL</text>

    <circle cx="${width * 0.85}" cy="${height * 0.72}" r="${aspect_ratio === "9:16" ? 50 : 64}" fill="url(#accentGrad)" filter="url(#shadowFilter)" />
    <polygon points="${width * 0.85 - 12},${height * 0.72 - 20} ${width * 0.85 + 20},${height * 0.72} ${width * 0.85 - 12},${height * 0.72 + 20}" fill="#ffffff" />
  </svg>`;

  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }

  const filename = `thumb_design_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.svg`;
  const filePath = path.join(thumbnailsDir, filename);
  fs.writeFileSync(filePath, svgContent, "utf8");

  return {
    thumbnail_url: `/storage/thumbnails/${filename}`,
    prompt_used: prompt,
    provider: "pollinations",
    message: "Miniatura gráfica personalizada generada con éxito"
  };
}