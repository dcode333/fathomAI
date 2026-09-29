"use server";

import { revalidatePath } from "next/cache";
import {
  WEBSITE_REDESIGN_DEMO,
  WEEKLY_SYNC_DEMO,
  scenarioForTitle,
  type DemoScenario,
} from "@/lib/meetings/demo-scenario";
import { createClient } from "@/lib/supabase/server";
import type { ActionItemStatus } from "@/lib/types/database";

async function attachScenarioIntelligence(
  meetingId: string,
  scenario: DemoScenario,
  options?: { replaceAnalysis?: boolean }
) {
  const supabase = await createClient();

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

  const { count: keyPointCount } = await supabase
    .from("meeting_key_points")
    .select("id", { count: "exact", head: true })
    .eq("meeting_id", meetingId);

  if ((keyPointCount ?? 0) === 0) {
    await supabase.from("meeting_key_points").insert(
      scenario.key_points.map((kp) => ({
        meeting_id: meetingId,
        content: kp.content,
        timestamp_seconds: kp.timestamp_seconds,
      }))
    );
  }

  const { data: existingAnalysis } = await supabase
    .from("meeting_analysis")
    .select("id")
    .eq("meeting_id", meetingId)
    .maybeSingle();

  if (!existingAnalysis) {
    await supabase.from("meeting_analysis").insert({
      meeting_id: meetingId,
      summary: scenario.summary,
    });
  } else if (options?.replaceAnalysis) {
    await supabase
      .from("meeting_analysis")
      .update({ summary: scenario.summary })
      .eq("meeting_id", meetingId);
  }

  const { count: decisionCount } = await supabase
    .from("meeting_decisions")
    .select("id", { count: "exact", head: true })
    .eq("meeting_id", meetingId);

  if ((decisionCount ?? 0) === 0) {
    await supabase.from("meeting_decisions").insert(
      scenario.decisions.map((d) => ({
        meeting_id: meetingId,
        decision: d.decision,
        timestamp_seconds: d.timestamp_seconds,
      }))
    );
  } else {
    // Backfill timestamps on existing decisions if missing
    const { data: decisions } = await supabase
      .from("meeting_decisions")
      .select("id, decision, timestamp_seconds")
      .eq("meeting_id", meetingId);

    for (const row of decisions ?? []) {
      if (row.timestamp_seconds != null) continue;
      const match = scenario.decisions.find((d) =>
        d.decision.toLowerCase().includes(row.decision.toLowerCase().slice(0, 20))
      );
      if (match) {
        await supabase
          .from("meeting_decisions")
          .update({ timestamp_seconds: match.timestamp_seconds })
          .eq("id", row.id);
      }
    }
  }

  const { count: actionCount } = await supabase
    .from("meeting_action_items")
    .select("id", { count: "exact", head: true })
    .eq("meeting_id", meetingId);

  if ((actionCount ?? 0) === 0) {
    await supabase.from("meeting_action_items").insert(
      scenario.action_items.map((item) => ({
        meeting_id: meetingId,
        task: item.task,
        assignee: item.assignee,
        due_date: item.due_date,
        status: "pending" as const,
        timestamp_seconds: item.timestamp_seconds,
      }))
    );
  } else {
    const { data: items } = await supabase
      .from("meeting_action_items")
      .select("id, task, timestamp_seconds, due_date")
      .eq("meeting_id", meetingId);

    for (const row of items ?? []) {
      if (row.timestamp_seconds != null) continue;
      const match = scenario.action_items.find((a) =>
        a.task.toLowerCase().includes(row.task.toLowerCase().slice(0, 18))
      );
      if (match) {
        await supabase
          .from("meeting_action_items")
          .update({
            timestamp_seconds: match.timestamp_seconds,
            due_date: row.due_date ?? match.due_date,
          })
          .eq("id", row.id);
      }
    }
  }
}

/**
 * Idempotent dashboard seed for empty accounts.
 */
export async function ensureDashboardSeed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { seeded: false, reason: "unauthenticated" as const };
  }

  const { count, error: countError } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return { seeded: false, reason: "count_failed" as const };
  }

  if ((count ?? 0) > 0) {
    return { seeded: false, reason: "already_has_meetings" as const };
  }

  const now = Date.now();
  const samples: { scenario: DemoScenario; hoursAgo: number }[] = [
    { scenario: WEBSITE_REDESIGN_DEMO, hoursAgo: 2 },
    { scenario: WEEKLY_SYNC_DEMO, hoursAgo: 26 },
  ];

  for (const { scenario, hoursAgo } of samples) {
    const started = new Date(now - hoursAgo * 60 * 60 * 1000);
    const ended = new Date(started.getTime() + scenario.duration_seconds * 1000);

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        user_id: user.id,
        title: scenario.title,
        source: "demo",
        status: "completed",
        duration_seconds: scenario.duration_seconds,
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
      })
      .select("id")
      .single();

    if (meetingError || !meeting) {
      console.error("seed meeting", meetingError?.message);
      continue;
    }

    await supabase.from("meeting_participants").insert(
      scenario.participants.map((p) => ({
        meeting_id: meeting.id,
        name: p.name,
        role: p.role,
      }))
    );

    await attachScenarioIntelligence(meeting.id, scenario);
  }

  return { seeded: true, reason: "ok" as const };
}

/** Backfill transcript / key points for older seeded meetings. */
export async function ensureMeetingIntelligence(meetingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, title, user_id, status")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting || meeting.user_id !== user.id) return { ok: false };
  if (meeting.status !== "completed") return { ok: false };

  const scenario = scenarioForTitle(meeting.title);
  if (!scenario) return { ok: false };

  await attachScenarioIntelligence(meetingId, scenario);
  return { ok: true };
}

export async function toggleActionItemStatus(
  actionItemId: string,
  meetingId: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: item } = await supabase
    .from("meeting_action_items")
    .select("id, status, meeting_id")
    .eq("id", actionItemId)
    .maybeSingle();

  if (!item || item.meeting_id !== meetingId) {
    return { error: "Action item not found" };
  }

  const next: ActionItemStatus =
    item.status === "completed" ? "pending" : "completed";

  const { error } = await supabase
    .from("meeting_action_items")
    .update({ status: next })
    .eq("id", actionItemId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/dashboard");
  return { error: null, status: next };
}

export async function createGoogleMeetMeeting(meetingUrl: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", meetingId: null };
  }

  const url = meetingUrl.trim();
  if (!url.includes("meet.google.com")) {
    return {
      error: "Enter a valid Google Meet URL (meet.google.com).",
      meetingId: null,
    };
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      user_id: user.id,
      title: "Google Meet session",
      meeting_url: url,
      source: "google_meet",
      status: "joining",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error: error?.message ?? "Could not create meeting.",
      meetingId: null,
    };
  }

  revalidatePath("/dashboard");
  return { error: null, meetingId: data.id };
}

/**
 * Starts the Demo Meeting path.
 * Client shows processing UI, then calls completeDemoMeeting.
 */
export async function startDemoMeeting() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in.", meetingId: null };
  }

  const scenario = WEBSITE_REDESIGN_DEMO;
  const startedAt = new Date();
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      user_id: user.id,
      title: scenario.title,
      source: "demo",
      status: "recording",
      started_at: startedAt.toISOString(),
      duration_seconds: scenario.duration_seconds,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error: error?.message ?? "Could not start demo meeting.",
      meetingId: null,
    };
  }

  await supabase.from("meeting_participants").insert(
    scenario.participants.map((p) => ({
      meeting_id: data.id,
      name: p.name,
      role: p.role,
    }))
  );

  revalidatePath("/dashboard");
  return { error: null, meetingId: data.id };
}
