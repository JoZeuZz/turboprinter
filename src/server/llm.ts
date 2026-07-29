// LLM provider: Gemini via SDK, or any OpenAI-compatible endpoint
// (LM Studio, local servers) selected with LLM_PROVIDER. Lazy-inits the SDK
// per call so missing env vars never crash server startup.
import { GoogleGenAI } from "@google/genai";

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

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

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