// LLM provider: Gemini via SDK, or any OpenAI-compatible endpoint
// (LM Studio, local servers) selected with LLM_PROVIDER. Lazy-inits the SDK
// per call so missing env vars never crash server startup.
import { GoogleGenAI } from "@google/genai";

export async function generateLlmContent(
  prompt: string,
  jsonMode = false,
  systemInstruction?: string
): Promise<string> {
  const llmProvider = process.env.LLM_PROVIDER || "gemini";

  if (llmProvider === "lmstudio" || llmProvider === "openai") {
    const apiBase = process.env.OPENAI_API_BASE || "http://localhost:1234/v1";
    const apiKey = process.env.OPENAI_API_KEY || "lm-studio";
    const model = process.env.OPENAI_MODEL || "loaded-model";

    console.log(`[LLM] Directing generation to local OpenAI/LM Studio endpoint: ${apiBase}`);

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }

    let finalPrompt = prompt;
    if (jsonMode && (llmProvider === "lmstudio" || !apiBase.includes("api.openai.com"))) {
      finalPrompt += "\n\nCRITICAL: Return ONLY a valid JSON object. Do not include any explanations, markdown code block backticks (like ```json), or text before or after the JSON.";
    }
    messages.push({ role: "user", content: finalPrompt });

    try {
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
    } catch (err: any) {
      console.error("Failed calling LM Studio/OpenAI API:", err);
      throw err;
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key configured. Set GEMINI_API_KEY or configure LLM_PROVIDER=lmstudio.");
  }
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    });

    return response.text || "";
  } catch (err: any) {
    console.error("Failed calling Gemini API via SDK:", err);
    throw err;
  }
}
