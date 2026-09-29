import { createClient } from "@/lib/supabase/server";

export type AiLogInput = {
  userId?: string | null;
  meetingId?: string | null;
  model: string;
  operation: string;
  startedAt: Date;
  completedAt?: Date;
  success: boolean;
  error?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export async function logAiOperation(input: AiLogInput) {
  try {
    const supabase = await createClient();
    const latencyMs = input.completedAt
      ? input.completedAt.getTime() - input.startedAt.getTime()
      : null;

    await supabase.from("ai_logs").insert({
      user_id: input.userId ?? null,
      meeting_id: input.meetingId ?? null,
      model: input.model,
      operation: input.operation,
      started_at: input.startedAt.toISOString(),
      completed_at: input.completedAt?.toISOString() ?? null,
      latency_ms: latencyMs,
      success: input.success,
      error: input.error ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
    });
  } catch (err) {
    console.error("ai log failed", err);
  }
}
