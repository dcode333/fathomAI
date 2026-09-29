"use server";

import { revalidatePath } from "next/cache";
import { analyzeMeetingTranscript } from "@/lib/ai/analyze-meeting";
import { askMeetingQuestion } from "@/lib/ai/ask-meeting";
import { generateFollowUpEmail } from "@/lib/ai/follow-up-email";
import {
  WEBSITE_REDESIGN_DEMO,
  scenarioForTitle,
} from "@/lib/meetings/demo-scenario";
import { parseTranscriptText } from "@/lib/meetings/parse-transcript";
import { createClient } from "@/lib/supabase/server";

async function requireUserMeeting(meetingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, meeting: null };

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting || meeting.user_id !== user.id) {
    return { supabase, user, meeting: null };
  }

  return { supabase, user, meeting };
}

async function replaceMeetingIntelligence(
  meetingId: string,
  analysis: Awaited<ReturnType<typeof analyzeMeetingTranscript>>["result"],
  templateId: string
) {
  const supabase = await createClient();

  await supabase.from("meeting_key_points").delete().eq("meeting_id", meetingId);
  await supabase.from("meeting_decisions").delete().eq("meeting_id", meetingId);
  await supabase.from("meeting_action_items").delete().eq("meeting_id", meetingId);

  const { data: existing } = await supabase
    .from("meeting_analysis")
    .select("id")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("meeting_analysis")
      .update({ summary: analysis.summary, template_id: templateId })
      .eq("meeting_id", meetingId);
  } else {
    await supabase.from("meeting_analysis").insert({
      meeting_id: meetingId,
      summary: analysis.summary,
      template_id: templateId,
    });
  }

  if (analysis.key_points.length) {
    await supabase.from("meeting_key_points").insert(
      analysis.key_points.map((kp) => ({
        meeting_id: meetingId,
        content: kp.text,
        timestamp_seconds: kp.timestamp,
      }))
    );
  }

  if (analysis.decisions.length) {
    await supabase.from("meeting_decisions").insert(
      analysis.decisions.map((d) => ({
        meeting_id: meetingId,
        decision: d.text,
        timestamp_seconds: d.timestamp,
      }))
    );
  }

  if (analysis.action_items.length) {
    await supabase.from("meeting_action_items").insert(
      analysis.action_items.map((item) => ({
        meeting_id: meetingId,
        task: item.task,
        assignee: item.assignee,
        due_date: item.due_date,
        status: "pending" as const,
        timestamp_seconds: item.timestamp,
      }))
    );
  }
}

/**
 * Completes a demo meeting for real:
 * 1) Persist the spoken transcript
 * 2) Run analysis (OpenAI if key present, else local transcript parser)
 * 3) Mark meeting completed
 */
export async function completeDemoMeeting(meetingId: string) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in." };
  if (!meeting) return { error: "Meeting not found." };

  if (meeting.status === "completed") {
    return { error: null, alreadyComplete: true, provider: null as string | null };
  }

  if (meeting.status !== "processing" && meeting.status !== "recording") {
    return { error: "This meeting is not ready to process." };
  }

  const scenario = scenarioForTitle(meeting.title) ?? WEBSITE_REDESIGN_DEMO;

  // Ensure transcript exists (from the simulated live conversation)
  const { count: segmentCount } = await supabase
    .from("transcript_segments")
    .select("id", { count: "exact", head: true })
    .eq("meeting_id", meetingId);

  if ((segmentCount ?? 0) === 0) {
    await supabase.from("transcript_segments").insert(
      scenario.transcript.map((seg) => ({
        meeting_id: meetingId,
        speaker: seg.speaker,
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time,
        sequence: seg.sequence,
      }))
    );
  }

  const { data: segments } = await supabase
    .from("transcript_segments")
    .select("speaker, text, start_time")
    .eq("meeting_id", meetingId)
    .order("sequence", { ascending: true });

  if (!segments?.length) {
    return { error: "Transcript is not available yet." };
  }

  try {
    const { result, provider, templateId } = await analyzeMeetingTranscript({
      segments: segments.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        start_time: Number(s.start_time),
      })),
      userId: user.id,
      meetingId,
    });

    await replaceMeetingIntelligence(meetingId, result, templateId);

    const startedAt = meeting.started_at
      ? new Date(meeting.started_at)
      : new Date();
    const duration = meeting.duration_seconds ?? scenario.duration_seconds;
    const endedAt = new Date(startedAt.getTime() + duration * 1000);

    const { error } = await supabase
      .from("meetings")
      .update({
        status: "completed",
        ended_at: endedAt.toISOString(),
        duration_seconds: duration,
        title: scenario.title,
      })
      .eq("id", meetingId);

    if (error) return { error: error.message };

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    return { error: null, alreadyComplete: false, provider };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    await supabase
      .from("meetings")
      .update({ status: "failed" })
      .eq("id", meetingId);
    revalidatePath(`/meetings/${meetingId}`);
    return { error: message };
  }
}

export async function retryMeetingAnalysis(
  meetingId: string,
  nextTemplateId?: string | null
) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in." };
  if (!meeting) return { error: "Meeting not found." };

  const { data: segments } = await supabase
    .from("transcript_segments")
    .select("speaker, text, start_time")
    .eq("meeting_id", meetingId)
    .order("sequence", { ascending: true });

  if (!segments?.length) {
    return { error: "Transcript is not available yet." };
  }

  try {
    const {
      result,
      provider,
      templateId,
    } = await analyzeMeetingTranscript({
      segments: segments.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        start_time: Number(s.start_time),
      })),
      userId: user.id,
      meetingId,
      templateId: nextTemplateId,
    });

    await replaceMeetingIntelligence(meetingId, result, templateId);

    if (meeting.status !== "completed") {
      await supabase
        .from("meetings")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", meetingId);
    }

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    return { error: null, provider, templateId };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Retry analysis failed",
    };
  }
}

export async function askMeetingAi(meetingId: string, question: string) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in.", result: null };
  if (!meeting) return { error: "Meeting not found.", result: null };

  const { data: segments } = await supabase
    .from("transcript_segments")
    .select("speaker, text, start_time")
    .eq("meeting_id", meetingId)
    .order("sequence", { ascending: true });

  if (!segments?.length) {
    return { error: "Transcript is not available yet.", result: null };
  }

  try {
    const { result, provider } = await askMeetingQuestion({
      segments: segments.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        start_time: Number(s.start_time),
      })),
      question,
      userId: user.id,
      meetingId,
    });
    return { error: null, result, provider };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ask AI failed",
      result: null,
    };
  }
}

export async function createFollowUpEmail(meetingId: string) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in.", result: null };
  if (!meeting) return { error: "Meeting not found.", result: null };

  const [{ data: analysis }, { data: decisions }, { data: actionItems }, { data: profile }, { data: participants }] =
    await Promise.all([
      supabase
        .from("meeting_analysis")
        .select("summary")
        .eq("meeting_id", meetingId)
        .maybeSingle(),
      supabase
        .from("meeting_decisions")
        .select("decision")
        .eq("meeting_id", meetingId),
      supabase
        .from("meeting_action_items")
        .select("task, assignee, due_date")
        .eq("meeting_id", meetingId),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("meeting_participants")
        .select("name, role")
        .eq("meeting_id", meetingId),
    ]);

  if (!analysis?.summary) {
    return { error: "Meeting summary is not available yet.", result: null };
  }

  const recipient =
    participants?.find((p) => /client/i.test(p.role ?? ""))?.name ||
    participants?.find((p) => p.name !== profile?.full_name?.split(" ")[0])
      ?.name ||
    null;

  try {
    const { result, provider } = await generateFollowUpEmail({
      title: meeting.title,
      summary: analysis.summary,
      decisions: (decisions ?? []).map((d) => d.decision),
      actionItems: (actionItems ?? []).map((a) => ({
        task: a.task,
        assignee: a.assignee,
        due_date: a.due_date,
      })),
      senderName: profile?.full_name?.split(" ")[0] || "there",
      recipientHint: recipient,
      userId: user.id,
      meetingId,
    });
    return { error: null, result, provider };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not generate email",
      result: null,
    };
  }
}

/**
 * Functional Google Meet path (temporary until live bot capture):
 * paste transcript → save segments → run same AI analysis pipeline.
 */
export async function importTranscriptAndAnalyze(
  meetingId: string,
  rawTranscript: string
) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in.", provider: null };
  if (!meeting) return { error: "Meeting not found.", provider: null };

  const segments = parseTranscriptText(rawTranscript);
  if (segments.length < 1) {
    return {
      error:
        "Could not parse transcript. Use lines like: Sarah: We need this by October 15.",
      provider: null,
    };
  }

  await supabase.from("transcript_segments").delete().eq("meeting_id", meetingId);
  await supabase.from("transcript_segments").insert(
    segments.map((seg) => ({
      meeting_id: meetingId,
      speaker: seg.speaker,
      text: seg.text,
      start_time: seg.start_time,
      end_time: seg.end_time,
      sequence: seg.sequence,
    }))
  );

  await supabase
    .from("meetings")
    .update({ status: "processing" })
    .eq("id", meetingId);

  try {
    const { result, provider, templateId } = await analyzeMeetingTranscript({
      segments: segments.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        start_time: s.start_time,
      })),
      userId: user.id,
      meetingId,
    });

    await replaceMeetingIntelligence(meetingId, result, templateId);

    const startedAt = meeting.started_at
      ? new Date(meeting.started_at)
      : new Date();
    const last = segments[segments.length - 1];
    const duration = Math.max(
      meeting.duration_seconds ?? 0,
      Math.ceil(last.start_time + 30)
    );

    await supabase
      .from("meetings")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        started_at: meeting.started_at ?? startedAt.toISOString(),
      })
      .eq("id", meetingId);

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    return { error: null, provider };
  } catch (err) {
    await supabase
      .from("meetings")
      .update({ status: "failed" })
      .eq("id", meetingId);
    revalidatePath(`/meetings/${meetingId}`);
    return {
      error: err instanceof Error ? err.message : "Analysis failed",
      provider: null,
    };
  }
}

/**
 * Pull transcript from Google Meet REST API after the call ends,
 * then run the same AI analysis pipeline.
 */
export async function fetchGoogleMeetTranscriptAndAnalyze(meetingId: string) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in.", provider: null };
  if (!meeting) return { error: "Meeting not found.", provider: null };
  if (!meeting.meeting_url) {
    return { error: "This meeting has no Google Meet URL.", provider: null };
  }

  const { getValidGoogleAccessToken } = await import("@/lib/google/calendar");
  const {
    fetchTranscriptSegmentsForMeet,
    fetchRecordingForMeet,
  } = await import("@/lib/google/meet");

  const { token, error: tokenError } = await getValidGoogleAccessToken(user.id);
  if (!token) {
    return {
      error:
        tokenError ??
        "Connect Google in Settings (reconnect to grant Meet transcript scopes).",
      provider: null,
    };
  }

  await supabase
    .from("meetings")
    .update({ status: "processing" })
    .eq("id", meetingId);

  try {
    // Recording first — its clock is what the video player uses.
    let recording: Awaited<
      ReturnType<typeof fetchRecordingForMeet>
    > = null;
    try {
      recording = await fetchRecordingForMeet({
        accessToken: token,
        meetingUrl: meeting.meeting_url,
      });
    } catch (recordingErr) {
      console.error(
        "Meet recording prefetch skipped:",
        recordingErr instanceof Error ? recordingErr.message : recordingErr
      );
    }

    const fetched = await fetchTranscriptSegmentsForMeet({
      accessToken: token,
      meetingUrl: meeting.meeting_url,
      recordingStartTime: recording?.startTime,
      mediaDurationSeconds: recording?.durationSeconds,
    });

    await supabase
      .from("transcript_segments")
      .delete()
      .eq("meeting_id", meetingId);

    await supabase.from("transcript_segments").insert(
      fetched.segments.map((seg) => ({
        meeting_id: meetingId,
        speaker: seg.speaker,
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time,
        sequence: seg.sequence,
      }))
    );

    const { result, provider, templateId } = await analyzeMeetingTranscript({
      segments: fetched.segments.map((s) => ({
        speaker: s.speaker,
        text: s.text,
        start_time: s.start_time,
      })),
      userId: user.id,
      meetingId,
    });

    await replaceMeetingIntelligence(meetingId, result, templateId);

    const last = fetched.segments[fetched.segments.length - 1];
    const duration = Math.max(
      recording?.durationSeconds ?? 0,
      Math.ceil((last?.end_time ?? last?.start_time ?? 0) + 2),
      meeting.duration_seconds ?? 0
    );

    const recordingUpdate = recording
      ? {
          conference_record_name: recording.conferenceRecord,
          recording_drive_file_id: recording.driveFileId,
          recording_export_uri: recording.exportUri,
          recording_state: recording.state,
        }
      : {
          conference_record_name: fetched.conferenceRecord,
        };

    await supabase
      .from("meetings")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        ...recordingUpdate,
      })
      .eq("id", meetingId);

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    return {
      error: null,
      provider,
      docsUri: fetched.docsUri,
      hasRecording: Boolean(recording?.driveFileId),
      retryable: false,
    };
  } catch (err) {
    // Leave meeting as joining so user can retry / paste
    await supabase
      .from("meetings")
      .update({ status: "joining" })
      .eq("id", meetingId);
    revalidatePath(`/meetings/${meetingId}`);
    const message =
      err instanceof Error ? err.message : "Could not fetch Meet transcript";
    const retryable =
      /no conference record|no transcript yet|not ready|still process|entries were empty|wait/i.test(
        message
      );
    return {
      error: message,
      provider: null,
      retryable,
    };
  }
}

/**
 * Attach / refresh Google Meet recording for an existing meeting
 * (transcript may already be imported).
 */
export async function fetchGoogleMeetRecording(meetingId: string) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in.", hasRecording: false };
  if (!meeting) return { error: "Meeting not found.", hasRecording: false };
  if (!meeting.meeting_url) {
    return { error: "This meeting has no Google Meet URL.", hasRecording: false };
  }

  const { getValidGoogleAccessToken } = await import("@/lib/google/calendar");
  const { fetchRecordingForMeet } = await import("@/lib/google/meet");

  const { token, error: tokenError } = await getValidGoogleAccessToken(user.id);
  if (!token) {
    return {
      error:
        tokenError ??
        "Connect Google in Settings (reconnect for Meet + Drive scopes).",
      hasRecording: false,
    };
  }

  try {
    const recording = await fetchRecordingForMeet({
      accessToken: token,
      meetingUrl: meeting.meeting_url,
      preferredConferenceRecord: meeting.conference_record_name,
    });

    if (!recording) {
      return {
        error:
          "No Meet recording found yet. In Meet: Activities → Recording, end the call, wait a few minutes, then retry.",
        hasRecording: false,
        retryable: true,
      };
    }

    if (recording.state && recording.state !== "FILE_GENERATED") {
      await supabase
        .from("meetings")
        .update({
          conference_record_name: recording.conferenceRecord,
          recording_state: recording.state,
          recording_drive_file_id: recording.driveFileId,
          recording_export_uri: recording.exportUri,
        })
        .eq("id", meetingId);
      revalidatePath(`/meetings/${meetingId}`);
      return {
        error: `Recording status is ${recording.state}. Wait until Google finishes generating the file, then retry.`,
        hasRecording: false,
        state: recording.state,
        retryable: true,
      };
    }

    if (!recording.driveFileId) {
      return {
        error:
          "Recording exists but Drive file id is missing. Open it in Drive from Meet chat/email and retry later.",
        hasRecording: false,
        retryable: true,
      };
    }

    await supabase
      .from("meetings")
      .update({
        conference_record_name: recording.conferenceRecord,
        recording_drive_file_id: recording.driveFileId,
        recording_export_uri: recording.exportUri,
        recording_state: recording.state,
      })
      .eq("id", meetingId);

    revalidatePath(`/meetings/${meetingId}`);
    return {
      error: null,
      hasRecording: true,
      state: recording.state,
      retryable: false,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not fetch Meet recording",
      hasRecording: false,
      retryable: false,
    };
  }
}

/**
 * Detect whether the Google Meet conference for this meeting has ended.
 * Used to auto-start import without a manual "I ended the call" click.
 */
export async function checkGoogleMeetEnded(meetingId: string) {
  const { user, meeting } = await requireUserMeeting(meetingId);
  if (!user) {
    return { error: "You must be signed in.", ended: false, found: false };
  }
  if (!meeting?.meeting_url) {
    return {
      error: "This meeting has no Google Meet URL.",
      ended: false,
      found: false,
    };
  }

  const { getValidGoogleAccessToken } = await import("@/lib/google/calendar");
  const { getMeetConferenceStatus } = await import("@/lib/google/meet");

  const { token, error: tokenError } = await getValidGoogleAccessToken(user.id);
  if (!token) {
    return {
      error: tokenError ?? "Google is not connected.",
      ended: false,
      found: false,
    };
  }

  try {
    const status = await getMeetConferenceStatus({
      accessToken: token,
      meetingUrl: meeting.meeting_url,
    });
    return {
      error: null,
      ended: status.ended,
      found: status.found,
      endTime: status.endTime,
      conferenceRecord: status.conferenceRecord,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not check Meet conference status",
      ended: false,
      found: false,
    };
  }
}

/**
 * Re-pull Meet transcript entry clocks with the fixed timestamp parser,
 * or estimate times if Google still returns zeros.
 */
export async function repairMeetingTranscriptTimestamps(meetingId: string) {
  const { supabase, user, meeting } = await requireUserMeeting(meetingId);
  if (!user) return { error: "You must be signed in." };
  if (!meeting) return { error: "Meeting not found." };

  const { data: existing } = await supabase
    .from("transcript_segments")
    .select("id, start_time, end_time, text, sequence")
    .eq("meeting_id", meetingId)
    .order("sequence", { ascending: true });

  const allZero =
    !!existing?.length &&
    existing.every((s) => Number(s.start_time) === 0 && !Number(s.end_time));

  const minStart = Math.min(
    ...(existing ?? []).map((s) => Number(s.start_time) || 0),
    0
  );
  const maxEnd = Math.max(
    ...(existing ?? []).map((s) =>
      Number(s.end_time ?? s.start_time) || 0
    ),
    0
  );
  const mediaDur = meeting.duration_seconds;
  // Conference-relative clocks that don't match the ~1–2 min recording
  const needsRebase =
    !!existing?.length &&
    !allZero &&
    (minStart >= 5 ||
      (mediaDur != null && mediaDur > 0 && maxEnd > mediaDur + 5));

  if (!allZero && !needsRebase) {
    await remapIntelligenceTimestamps(
      meetingId,
      (existing ?? []).map((s) => Number(s.start_time))
    );
    return { error: null, repaired: false, reason: "timestamps_look_ok" as const };
  }

  if (needsRebase && existing?.length) {
    const { rebaseSegmentsToMediaTimeline } = await import(
      "@/lib/google/meet"
    );
    // Prefer known recording length (~92s from player) over inflated conference duration
    const targetDur =
      mediaDur && mediaDur > 0 && maxEnd > mediaDur
        ? // If duration was wrongly set from conference transcript max, use span after rebase
          null
        : mediaDur;

    // First shift so first cue is 0:00
    let rebased = rebaseSegmentsToMediaTimeline(
      existing.map((s) => ({
        id: s.id,
        text: s.text,
        start_time: Number(s.start_time),
        end_time: s.end_time != null ? Number(s.end_time) : null,
      })),
      { mediaDurationSeconds: targetDur }
    );

    // If still longer than a typical short Meet recording while duration says ~3min
    // from transcript, clamp to the rebased span.
    const newMax = Math.max(
      ...rebased.map((s) => s.end_time ?? s.start_time),
      0
    );

    for (const row of rebased) {
      await supabase
        .from("transcript_segments")
        .update({
          start_time: row.start_time,
          end_time: row.end_time,
        })
        .eq("id", row.id);
    }

    await supabase
      .from("meetings")
      .update({
        duration_seconds: Math.max(newMax, 1),
      })
      .eq("id", meetingId);

    await remapIntelligenceTimestamps(
      meetingId,
      rebased.map((s) => s.start_time)
    );
    return { error: null, repaired: true, reason: "rebased_to_media" as const };
  }

  if (meeting.source === "google_meet" && meeting.meeting_url) {
    try {
      const { getValidGoogleAccessToken } = await import("@/lib/google/calendar");
      const { fetchTranscriptSegmentsForMeet } = await import("@/lib/google/meet");
      const { token } = await getValidGoogleAccessToken(user.id);
      if (token) {
        const fetched = await fetchTranscriptSegmentsForMeet({
          accessToken: token,
          meetingUrl: meeting.meeting_url,
        });
        await supabase
          .from("transcript_segments")
          .delete()
          .eq("meeting_id", meetingId);
        await supabase.from("transcript_segments").insert(
          fetched.segments.map((seg) => ({
            meeting_id: meetingId,
            speaker: seg.speaker,
            text: seg.text,
            start_time: seg.start_time,
            end_time: seg.end_time,
            sequence: seg.sequence,
          }))
        );
        const last = fetched.segments[fetched.segments.length - 1];
        await supabase
          .from("meetings")
          .update({
            duration_seconds: Math.max(
              meeting.duration_seconds ?? 0,
              Math.ceil((last?.end_time ?? last?.start_time ?? 0) + 5)
            ),
            conference_record_name: fetched.conferenceRecord,
          })
          .eq("id", meetingId);
        await remapIntelligenceTimestamps(
          meetingId,
          fetched.segments.map((s) => s.start_time)
        );
        return { error: null, repaired: true, reason: "refetched" as const };
      }
    } catch (err) {
      console.error(
        "timestamp repair refetch failed, falling back to estimate",
        err
      );
    }
  }

  const { estimateSegmentTimes } = await import("@/lib/google/meet");
  const estimated = estimateSegmentTimes(
    (existing ?? []).map((s) => ({
      text: s.text,
      start_time: Number(s.start_time),
      end_time: s.end_time != null ? Number(s.end_time) : null,
    })),
    meeting.duration_seconds
  );

  for (let i = 0; i < (existing ?? []).length; i++) {
    await supabase
      .from("transcript_segments")
      .update({
        start_time: estimated[i].start_time,
        end_time: estimated[i].end_time,
      })
      .eq("id", existing![i].id);
  }

  const last = estimated[estimated.length - 1];
  await supabase
    .from("meetings")
    .update({
      duration_seconds: Math.max(
        meeting.duration_seconds ?? 0,
        last?.end_time ?? last?.start_time ?? 0
      ),
    })
    .eq("id", meetingId);

  await remapIntelligenceTimestamps(
    meetingId,
    estimated.map((s) => s.start_time)
  );

  return { error: null, repaired: true, reason: "estimated" as const };
}

async function remapIntelligenceTimestamps(
  meetingId: string,
  segmentStarts: number[]
) {
  if (!segmentStarts.length) return;
  const supabase = await createClient();

  const [{ data: keyPoints }, { data: decisions }, { data: actions }] =
    await Promise.all([
      supabase
        .from("meeting_key_points")
        .select("id, timestamp_seconds")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("meeting_decisions")
        .select("id, timestamp_seconds")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("meeting_action_items")
        .select("id, timestamp_seconds")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
    ]);

  const assign = async (
    rows: { id: string; timestamp_seconds: number | null }[] | null,
    table:
      | "meeting_key_points"
      | "meeting_decisions"
      | "meeting_action_items"
  ) => {
    if (!rows?.length) return;
    const needsFix = rows.every(
      (r) => r.timestamp_seconds == null || Number(r.timestamp_seconds) === 0
    );
    if (!needsFix) return;
    for (let i = 0; i < rows.length; i++) {
      const start =
        segmentStarts[Math.min(i, segmentStarts.length - 1)] ?? 0;
      await supabase
        .from(table)
        .update({ timestamp_seconds: start })
        .eq("id", rows[i].id);
    }
  };

  await assign(keyPoints, "meeting_key_points");
  await assign(decisions, "meeting_decisions");
  await assign(actions, "meeting_action_items");
}
