import type { TranscriptInput } from "@/lib/ai/analyze-meeting";

/** Soft char budget before we switch to multi-pass analysis. */
export const LONG_MEETING_CHAR_THRESHOLD = 12_000;

/** Target chunk size in characters (with overlap via shared boundary speakers). */
export const CHUNK_TARGET_CHARS = 8_000;

export type TranscriptChunk = {
  index: number;
  segments: TranscriptInput[];
  text: string;
  startTime: number;
  endTime: number;
};

export function estimateTranscriptChars(segments: TranscriptInput[]): number {
  return segments.reduce(
    (sum, s) => sum + s.speaker.length + s.text.length + 12,
    0
  );
}

export function needsChunkedAnalysis(segments: TranscriptInput[]): boolean {
  return estimateTranscriptChars(segments) > LONG_MEETING_CHAR_THRESHOLD;
}

/**
 * Split a long transcript into overlapping time-ordered chunks so an hour-long
 * / multi-speaker meeting still fits model context.
 */
export function chunkTranscript(
  segments: TranscriptInput[],
  targetChars = CHUNK_TARGET_CHARS
): TranscriptChunk[] {
  if (segments.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let current: TranscriptInput[] = [];
  let currentChars = 0;

  const flush = () => {
    if (!current.length) return;
    const text = current
      .map((s) => `[${Math.floor(s.start_time)}s] ${s.speaker}: ${s.text}`)
      .join("\n");
    chunks.push({
      index: chunks.length,
      segments: current,
      text,
      startTime: current[0].start_time,
      endTime: current[current.length - 1].start_time,
    });
    // Overlap: keep last 2 segments so decisions near boundaries aren't lost
    const overlap = current.slice(-2);
    current = [...overlap];
    currentChars = overlap.reduce(
      (sum, s) => sum + s.speaker.length + s.text.length + 12,
      0
    );
  };

  for (const seg of segments) {
    const size = seg.speaker.length + seg.text.length + 12;
    if (current.length > 0 && currentChars + size > targetChars) {
      flush();
    }
    current.push(seg);
    currentChars += size;
  }
  flush();

  return chunks;
}

function dedupeByText<T extends { text: string; timestamp: number | null }>(
  items: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = item.text.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeActions(
  items: {
    task: string;
    assignee: string | null;
    due_date: string | null;
    timestamp: number | null;
  }[]
) {
  const seen = new Set<string>();
  const out: typeof items = [];
  for (const item of items) {
    const key = item.task.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mergePartialAnalyses(
  partials: {
    summary: string;
    key_points: { text: string; timestamp: number | null }[];
    decisions: { text: string; timestamp: number | null }[];
    action_items: {
      task: string;
      assignee: string | null;
      due_date: string | null;
      timestamp: number | null;
    }[];
  }[]
) {
  return {
    chunkSummaries: partials.map((p) => p.summary),
    key_points: dedupeByText(partials.flatMap((p) => p.key_points)).slice(
      0,
      16
    ),
    decisions: dedupeByText(partials.flatMap((p) => p.decisions)).slice(0, 12),
    action_items: dedupeActions(partials.flatMap((p) => p.action_items)).slice(
      0,
      20
    ),
  };
}
