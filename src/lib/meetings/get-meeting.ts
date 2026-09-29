import { createClient } from "@/lib/supabase/server";
import type {
  Meeting,
  MeetingActionItem,
  MeetingClip,
  MeetingDecision,
  MeetingHighlight,
  MeetingKeyPoint,
  MeetingParticipant,
  TranscriptSegment,
} from "@/lib/types/database";

export type MeetingDetail = Meeting & {
  meeting_participants: MeetingParticipant[];
  meeting_analysis: {
    id: string;
    summary: string;
    template_id: string | null;
  } | null;
  meeting_key_points: MeetingKeyPoint[];
  meeting_decisions: MeetingDecision[];
  meeting_action_items: MeetingActionItem[];
  transcript_segments: TranscriptSegment[];
  meeting_highlights: MeetingHighlight[];
  meeting_clips: Pick<
    MeetingClip,
    "id" | "share_token" | "title" | "quote" | "start_seconds" | "speaker" | "created_at"
  >[];
};

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getMeetingDetail(
  meetingId: string
): Promise<MeetingDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("meetings")
    .select(
      `
      *,
      meeting_participants ( * ),
      meeting_analysis ( id, summary, template_id ),
      meeting_key_points ( * ),
      meeting_decisions ( * ),
      meeting_action_items ( * ),
      transcript_segments ( * ),
      meeting_highlights ( * ),
      meeting_clips ( id, share_token, title, quote, start_seconds, speaker, created_at )
    `
    )
    .eq("id", meetingId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getMeetingDetail", error.message);
    return null;
  }

  const segments = [...(data.transcript_segments ?? [])].sort(
    (a, b) => a.sequence - b.sequence
  );

  return {
    ...data,
    meeting_participants: data.meeting_participants ?? [],
    meeting_analysis: firstOrNull(data.meeting_analysis),
    meeting_key_points: [...(data.meeting_key_points ?? [])].sort(
      (a, b) => Number(a.timestamp_seconds ?? 0) - Number(b.timestamp_seconds ?? 0)
    ),
    meeting_decisions: data.meeting_decisions ?? [],
    meeting_action_items: data.meeting_action_items ?? [],
    transcript_segments: segments,
    meeting_highlights: [...(data.meeting_highlights ?? [])].sort(
      (a, b) =>
        Number(a.timestamp_seconds ?? 0) - Number(b.timestamp_seconds ?? 0)
    ),
    meeting_clips: data.meeting_clips ?? [],
  };
}
