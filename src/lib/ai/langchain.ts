import {
  ChatOpenAI,
  OpenAIEmbeddings,
  type ChatOpenAIFields,
} from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import {
  hasOpenAiKey,
  parseJsonWithSchema,
  type ChatJsonResult,
} from "@/lib/ai/openai";

/**
 * Shared LangChain setup for RekApp.
 * Existing `chatJson` callers keep working; new features can use this module.
 */

export function getOpenAiModelName(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function getChatModel(options?: Partial<ChatOpenAIFields>): ChatOpenAI {
  if (!hasOpenAiKey()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    model: getOpenAiModelName(),
    temperature: 0.2,
    ...options,
  });
}

export function getEmbeddings(): OpenAIEmbeddings {
  if (!hasOpenAiKey()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  });
}

/**
 * LangChain equivalent of `chatJson` — JSON-object responses with optional Zod parse.
 * Use for new LangChain-backed features; migrate existing callers when ready.
 */
export async function chatJsonWithLangChain(options: {
  system: string;
  user: string;
  schemaName?: string;
}): Promise<ChatJsonResult> {
  const model = getChatModel({
    modelKwargs: {
      response_format: { type: "json_object" },
    },
  });

  const messages: BaseMessage[] = [
    new SystemMessage(options.system),
    new HumanMessage(options.user),
  ];

  const response = await model.invoke(messages);
  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  if (!content.trim()) {
    throw new Error("LangChain/OpenAI returned an empty response");
  }

  return {
    content,
    model: response.response_metadata?.model_name ?? getOpenAiModelName(),
    inputTokens: response.usage_metadata?.input_tokens ?? null,
    outputTokens: response.usage_metadata?.output_tokens ?? null,
  };
}

export async function invokeStructuredJson<T>(options: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
}): Promise<{ result: T; provider: "openai"; model: string }> {
  const raw = await chatJsonWithLangChain({
    system: options.system,
    user: options.user,
  });
  const result = parseJsonWithSchema(raw.content, options.schema);
  return { result, provider: "openai", model: raw.model };
}

export {
  createAgent,
  createMiddleware,
  HumanMessage,
  SystemMessage,
  tool,
} from "langchain";

export { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
export { hasOpenAiKey };
