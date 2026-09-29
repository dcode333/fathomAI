import {
  chunkTranscript,
  mergePartialAnalyses,
  needsChunkedAnalysis,
} from "@/lib/ai/chunk-transcript";
import { logAiOperation } from "@/lib/ai/logger";
import { analyzeTranscriptLocally } from "@/lib/ai/local-fallback";
import { chatJson, hasOpenAiKey, parseJsonWithSchema } from "@/lib/ai/openai";
import {
  buildChunkAnalysisUserPrompt,
  buildMeetingAnalysisUserPrompt,
  buildMergedSummaryUserPrompt,
  MEETING_ANALYSIS_SYSTEM,
} from "@/lib/ai/prompts/meeting";
import {
  meetingAnalysisSchema,
  type MeetingAnalysisResult,
} from "@/lib/ai/schemas";
import {
  DEFAULT_TEMPLATE_ID,
  getSummaryTemplate,
  isSummaryTemplateId,
  type SummaryTemplateId,
} from "@/lib/ai/templates";
import { z } from "zod";

export type TranscriptInput = {
  speaker: string;
  text: string;
  start_time: number;
};

export function formatTranscript(segments: TranscriptInput[]): string {
  return segments
    .map(
      (s) => `[${Math.floor(s.start_time)}s] ${s.speaker}: ${s.text}`
    )
    .join("\n");
}

function resolveTemplateId(
  templateId?: string | null
): SummaryTemplateId {
  if (templateId && isSummaryTemplateId(templateId)) return templateId;
  return DEFAULT_TEMPLATE_ID;
}

async function analyzeSinglePass(options: {
  transcript: string;
  templateId: SummaryTemplateId;
}): Promise<{
  result: MeetingAnalysisResult;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}> {
  const raw = await chatJson({
    system: MEETING_ANALYSIS_SYSTEM,
    user: buildMeetingAnalysisUserPrompt(options.transcript, options.templateId),
    schemaName: "meeting_analysis",
  });
  return {
    result: parseJsonWithSchema(raw.content, meetingAnalysisSchema),
    model: raw.model,
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
  };
}

async function analyzeChunked(options: {
  segments: TranscriptInput[];
  templateId: SummaryTemplateId;
}): Promise<{
  result: MeetingAnalysisResult;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}> {
  const chunks = chunkTranscript(options.segments);
  const partials: MeetingAnalysisResult[] = [];
  let model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  let inputTokens = 0;
  let outputTokens = 0;

  for (const chunk of chunks) {
    const raw = await chatJson({
      system: MEETING_ANALYSIS_SYSTEM,
      user: buildChunkAnalysisUserPrompt(
        chunk.text,
        chunk.index,
        chunks.length,
        options.templateId
      ),
      schemaName: "meeting_analysis_chunk",
    });
    partials.push(parseJsonWithSchema(raw.content, meetingAnalysisSchema));
    model = raw.model;
    inputTokens += raw.inputTokens ?? 0;
    outputTokens += raw.outputTokens ?? 0;
  }

  const merged = mergePartialAnalyses(partials);

  const summaryRaw = await chatJson({
    system: MEETING_ANALYSIS_SYSTEM,
    user: buildMergedSummaryUserPrompt(merged.chunkSummaries, options.templateId),
    schemaName: "meeting_summary_merge",
  });
  const summaryParsed = parseJsonWithSchema(
    summaryRaw.content,
    z.object({ summary: z.string().min(1) })
  );
  inputTokens += summaryRaw.inputTokens ?? 0;
  outputTokens += summaryRaw.outputTokens ?? 0;
  model = summaryRaw.model;

  return {
    result: {
      summary: summaryParsed.summary,
      key_points: merged.key_points,
      decisions: merged.decisions,
      action_items: merged.action_items,
    },
    model,
    inputTokens,
    outputTokens,
  };
}

export async function analyzeMeetingTranscript(options: {
  segments: TranscriptInput[];
  userId?: string | null;
  meetingId?: string | null;
  templateId?: string | null;
}): Promise<{
  result: MeetingAnalysisResult;
  provider: "openai" | "local";
  model: string;
  templateId: SummaryTemplateId;
  chunked: boolean;
}> {
  const startedAt = new Date();
  const templateId = resolveTemplateId(options.templateId);
  const transcript = formatTranscript(options.segments);
  const chunked = needsChunkedAnalysis(options.segments);

  if (!transcript.trim()) {
    throw new Error("Transcript is empty — nothing to analyze.");
  }

  if (hasOpenAiKey()) {
    try {
      const analyzed = chunked
        ? await analyzeChunked({
            segments: options.segments,
            templateId,
          })
        : await analyzeSinglePass({ transcript, templateId });

      await logAiOperation({
        userId: options.userId,
        meetingId: options.meetingId,
        model: analyzed.model,
        operation: chunked
          ? `meeting_analysis_chunked:${templateId}`
          : `meeting_analysis:${templateId}`,
        startedAt,
        completedAt: new Date(),
        success: true,
        inputTokens: analyzed.inputTokens,
        outputTokens: analyzed.outputTokens,
      });
      return {
        result: analyzed.result,
        provider: "openai",
        model: analyzed.model,
        templateId,
        chunked,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI analysis failed";
      await logAiOperation({
        userId: options.userId,
        meetingId: options.meetingId,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        operation: `meeting_analysis:${templateId}`,
        startedAt,
        completedAt: new Date(),
        success: false,
        error: message,
      });
      console.error("OpenAI analysis failed, using local fallback:", message);
    }
  }

  const result = analyzeTranscriptLocally(options.segments);
  // Soft-shape local summary with template label so switching still feels intentional
  const template = getSummaryTemplate(templateId);
  if (templateId !== "general") {
    result.summary = `${template.label} view — ${result.summary}`;
  }

  await logAiOperation({
    userId: options.userId,
    meetingId: options.meetingId,
    model: "local-heuristic",
    operation: `meeting_analysis:${templateId}`,
    startedAt,
    completedAt: new Date(),
    success: true,
  });
  return {
    result,
    provider: "local",
    model: "local-heuristic",
    templateId,
    chunked,
  };
}
