import { logAiOperation } from "@/lib/ai/logger";
import { draftFollowUpEmailLocally } from "@/lib/ai/local-fallback";
import { chatJson, hasOpenAiKey, parseJsonWithSchema } from "@/lib/ai/openai";
import {
  buildFollowUpEmailUserPrompt,
  FOLLOW_UP_EMAIL_SYSTEM,
} from "@/lib/ai/prompts/meeting";
import {
  followUpEmailSchema,
  type FollowUpEmailResult,
} from "@/lib/ai/schemas";

export async function generateFollowUpEmail(options: {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: {
    task: string;
    assignee: string | null;
    due_date: string | null;
  }[];
  senderName: string;
  recipientHint?: string | null;
  userId?: string | null;
  meetingId?: string | null;
}): Promise<{ result: FollowUpEmailResult; provider: "openai" | "local" }> {
  const startedAt = new Date();
  const promptInput = {
    title: options.title,
    summary: options.summary,
    decisions: options.decisions,
    actionItems: options.actionItems,
    senderName: options.senderName,
    recipientHint: options.recipientHint,
  };

  if (hasOpenAiKey()) {
    try {
      const raw = await chatJson({
        system: FOLLOW_UP_EMAIL_SYSTEM,
        user: buildFollowUpEmailUserPrompt(promptInput),
        schemaName: "follow_up_email",
      });
      const result = parseJsonWithSchema(raw.content, followUpEmailSchema);
      await logAiOperation({
        userId: options.userId,
        meetingId: options.meetingId,
        model: raw.model,
        operation: "follow_up_email",
        startedAt,
        completedAt: new Date(),
        success: true,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
      });
      return { result, provider: "openai" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Email generation failed";
      await logAiOperation({
        userId: options.userId,
        meetingId: options.meetingId,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        operation: "follow_up_email",
        startedAt,
        completedAt: new Date(),
        success: false,
        error: message,
      });
      console.error("OpenAI email failed, using local fallback:", message);
    }
  }

  const result = draftFollowUpEmailLocally(promptInput);
  await logAiOperation({
    userId: options.userId,
    meetingId: options.meetingId,
    model: "local-heuristic",
    operation: "follow_up_email",
    startedAt,
    completedAt: new Date(),
    success: true,
  });
  return { result, provider: "local" };
}
