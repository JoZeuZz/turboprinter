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

  // Provider 1: Gemini (Imagen 3)
  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("No hay clave de API de Gemini configurada. Por favor define GEMINI_API_KEY en la configuración o variables de entorno.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    console.log(`[Thumbnail] Generating Imagen 3 image for "${video_subject}" with prompt: "${thumbnailPrompt}"`);

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: thumbnailPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspect_ratio === "9:16" ? "9:16" : aspect_ratio === "1:1" ? "1:1" : "16:9",
      },
    });

    const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
    if (!base64Data) {
      throw new Error("La API de Gemini Imagen no devolvió datos de imagen.");
    }

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
      message: "Miniatura generada con éxito usando Gemini Imagen 3"
    };
  }

  // Provider 2: Pollinations.ai (Gratuito, sin clave de API)
  if (provider === "pollinations") {
    const width = aspect_ratio === "9:16" ? 720 : aspect_ratio === "1:1" ? 1024 : 1280;
    const height = aspect_ratio === "9:16" ? 1280 : aspect_ratio === "1:1" ? 1024 : 720;
    const seed = Math.floor(Math.random() * 1000000);
    const encodedPrompt = encodeURIComponent(thumbnailPrompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

    console.log(`[Thumbnail] Fetching image from Pollinations.ai: ${pollinationsUrl}`);
    const response = await fetch(pollinationsUrl);

    if (!response.ok) {
      throw new Error(`Error en Pollinations.ai (${response.status}): ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const imgBuffer = Buffer.from(arrayBuffer);

    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    const filename = `thumb_pollinations_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.jpg`;
    const filePath = path.join(thumbnailsDir, filename);
    fs.writeFileSync(filePath, imgBuffer);

    return {
      thumbnail_url: `/storage/thumbnails/${filename}`,
      prompt_used: thumbnailPrompt,
      provider: "pollinations",
      message: "Miniatura generada con éxito usando Pollinations.ai (Gratuito)"
    };
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