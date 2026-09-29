import { z } from "zod";

export type ChatJsonResult = {
  content: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

/**
 * Thin OpenAI chat wrapper. Swappable later (Anthropic, etc.).
 */
export async function chatJson(options: {
  system: string;
  user: string;
  schemaName: string;
}): Promise<ChatJsonResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${body.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return {
    content,
    model: data.model ?? model,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  };
}

export function parseJsonWithSchema<T>(
  content: string,
  schema: z.ZodType<T>
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Sometimes models wrap JSON in fences
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model did not return valid JSON");
    parsed = JSON.parse(match[0]);
  }
  return schema.parse(parsed);
}

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
