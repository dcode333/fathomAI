"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUserMeeting(meetingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, meeting: null };

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, user_id, title")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting || meeting.user_id !== user.id) {
    return { supabase, user, meeting: null };
  }

  return { supabase, user, meeting };
}

export async function createMeetingHighlight(input: {
  meetingId: string;
  timestampSeconds: number;
  quote: string;
  speaker?: string | null;
  note?: string | null;
  source?: "live" | "review";
}) {
  const { supabase, user, meeting } = await requireUserMeeting(input.meetingId);
  if (!user) return { error: "You must be signed in.", highlight: null };
  if (!meeting) return { error: "Meeting not found.", highlight: null };

  const quote = input.quote.trim();
  if (!quote) return { error: "Nothing to highlight.", highlight: null };

  const { data, error } = await supabase
    .from("meeting_highlights")
    .insert({
      meeting_id: input.meetingId,
      user_id: user.id,
      timestamp_seconds: Math.max(0, input.timestampSeconds),
      speaker: input.speaker?.trim() || null,
      quote,
      note: input.note?.trim() || null,
      source: input.source ?? "review",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not save highlight.", highlight: null };
  }

  revalidatePath(`/meetings/${input.meetingId}`);
  return { error: null, highlight: data };
}

export async function deleteMeetingHighlight(
  meetingId: string,
  highlightId: string
) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in." };
  if (!meeting) return { error: "Meeting not found." };

  const { error } = await supabase
    .from("meeting_highlights")
    .delete()
    .eq("id", highlightId)
    .eq("meeting_id", meetingId);

  if (error) return { error: error.message };

  revalidatePath(`/meetings/${meetingId}`);
  return { error: null };
}

export async function createShareClip(input: {
  meetingId: string;
  quote: string;
  speaker?: string | null;
  startSeconds: number;
  endSeconds?: number | null;
  note?: string | null;
  title?: string | null;
  highlightId?: string | null;
}) {
  const { supabase, user, meeting } = await requireUserMeeting(input.meetingId);
  if (!user) return { error: "You must be signed in.", clip: null, url: null };
  if (!meeting) return { error: "Meeting not found.", clip: null, url: null };

  const quote = input.quote.trim();
  if (!quote) return { error: "Nothing to share.", clip: null, url: null };

  const { data, error } = await supabase
    .from("meeting_clips")
    .insert({
      meeting_id: input.meetingId,
      highlight_id: input.highlightId ?? null,
      created_by: user.id,
      title: input.title?.trim() || `Moment from ${meeting.title}`,
      quote,
      speaker: input.speaker?.trim() || null,
      start_seconds: Math.max(0, input.startSeconds),
      end_seconds: input.endSeconds ?? null,
      note: input.note?.trim() || null,
      meeting_title: meeting.title,
    })
    .select("id, share_token, title, quote, start_seconds")
    .single();

  if (error || !data) {
    return {
      error: error?.message ?? "Could not create share link.",
      clip: null,
      url: null,
    };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const url = `${appUrl}/share/${data.share_token}`;

  revalidatePath(`/meetings/${input.meetingId}`);
  return { error: null, clip: data, url };
}

export async function createClipFromHighlight(
  meetingId: string,
  highlightId: string
) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in.", url: null };
  if (!meeting) return { error: "Meeting not found.", url: null };

  const { data: highlight } = await supabase
    .from("meeting_highlights")
    .select("*")
    .eq("id", highlightId)
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (!highlight) return { error: "Highlight not found.", url: null };

  return createShareClip({
    meetingId,
    highlightId,
    quote: highlight.quote,
    speaker: highlight.speaker,
    startSeconds: Number(highlight.timestamp_seconds),
    note: highlight.note,
    title: `Highlight · ${meeting.title}`,
  });
}
