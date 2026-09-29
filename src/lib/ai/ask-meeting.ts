import { logAiOperation } from "@/lib/ai/logger";
import { answerFromTranscriptLocally } from "@/lib/ai/local-fallback";
import { chatJson, hasOpenAiKey, parseJsonWithSchema } from "@/lib/ai/openai";
import {
  buildMeetingQaUserPrompt,
  MEETING_QA_SYSTEM,
} from "@/lib/ai/prompts/meeting";
import {
  meetingAnswerSchema,
  type MeetingAnswerResult,
} from "@/lib/ai/schemas";
import {
  formatTranscript,
  type TranscriptInput,
} from "@/lib/ai/analyze-meeting";

export async function askMeetingQuestion(options: {
  segments: TranscriptInput[];
  question: string;
  userId?: string | null;
  meetingId?: string | null;
}): Promise<{
  result: MeetingAnswerResult;
  provider: "openai" | "local";
}> {
  const startedAt = new Date();
  const question = options.question.trim();
  if (!question) throw new Error("Question is required.");

  const transcript = formatTranscript(options.segments);
  if (!transcript.trim()) throw new Error("Transcript is not available yet.");

  if (hasOpenAiKey()) {
    try {
      const raw = await chatJson({
        system: MEETING_QA_SYSTEM,
        user: buildMeetingQaUserPrompt(transcript, question),
        schemaName: "meeting_qa",
      });
      const result = parseJsonWithSchema(raw.content, meetingAnswerSchema);
      await logAiOperation({
        userId: options.userId,
        meetingId: options.meetingId,
        model: raw.model,
        operation: "meeting_qa",
        startedAt,
        completedAt: new Date(),
        success: true,
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
      });
      return { result, provider: "openai" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ask AI failed";
      await logAiOperation({
        userId: options.userId,
        meetingId: options.meetingId,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        operation: "meeting_qa",
        startedAt,
        completedAt: new Date(),
        success: false,
        error: message,
      });
      console.error("OpenAI Q&A failed, using local fallback:", message);
    }
  }

  const result = answerFromTranscriptLocally(options.segments, question);
  await logAiOperation({
    userId: options.userId,
    meetingId: options.meetingId,
    model: "local-heuristic",
    operation: "meeting_qa",
    startedAt,
    completedAt: new Date(),
    success: true,
  });
  return { result, provider: "local" };
}
