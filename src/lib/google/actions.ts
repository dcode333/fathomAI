"use server";

import { revalidatePath } from "next/cache";
import {
  createGoogleMeetEvent,
  getValidGoogleAccessToken,
} from "@/lib/google/calendar";
import { getGoogleClientConfig, DRIVE_MEET_SCOPE, DRIVE_READONLY_SCOPE } from "@/lib/google/config";
import { createMeetSpace } from "@/lib/google/meet";
import { createClient } from "@/lib/supabase/server";

export async function getGoogleConnectionStatus() {
  const { configured } = getGoogleClientConfig();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      configured,
      connected: false,
      email: null as string | null,
      hasMeetScopes: false,
      hasDriveScopes: false,
    };
  }

  const { data } = await supabase
    .from("google_integrations")
    .select("google_email, scopes")
    .eq("user_id", user.id)
    .maybeSingle();

  const scopes = data?.scopes ?? [];
  const hasMeetScopes = scopes.some((s) =>
    s.includes("meetings.space")
  );
  const hasDriveScopes = scopes.some(
    (s) => s === DRIVE_MEET_SCOPE || s === DRIVE_READONLY_SCOPE
  );
  const hasDriveMeetScope = scopes.includes(DRIVE_MEET_SCOPE);

  return {
    configured,
    connected: Boolean(data),
    email: data?.google_email ?? null,
    hasMeetScopes,
    hasDriveScopes,
    hasDriveMeetScope,
  };
}

export async function disconnectGoogle() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  await supabase.from("google_integrations").delete().eq("user_id", user.id);
  revalidatePath("/settings/integrations");
  return { error: null };
}

export async function createMeetWithNotetaker(title?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in.", meetingId: null, meetUrl: null };
  }

  const { token, error: tokenError } = await getValidGoogleAccessToken(user.id);
  if (!token) {
    return {
      error: tokenError ?? "Connect Google in Settings first.",
      meetingId: null,
      meetUrl: null,
    };
  }

  const meetingTitle = title?.trim() || "RekApp Meeting";

  try {
    let meetUrl: string;
    let usedMeetApi = false;

    try {
      const space = await createMeetSpace(token);
      meetUrl = space.meetUrl;
      usedMeetApi = true;
    } catch (meetErr) {
      // Fall back to Calendar conferenceData if Meet API isn't available yet
      console.warn("Meet createSpace failed, using Calendar:", meetErr);
      const cal = await createGoogleMeetEvent({
        accessToken: token,
        title: meetingTitle,
      });
      meetUrl = cal.meetUrl;
    }

    const { data, error } = await supabase
      .from("meetings")
      .insert({
        user_id: user.id,
        title: meetingTitle,
        meeting_url: meetUrl,
        source: "google_meet",
        status: "joining",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        error: error?.message ?? "Could not create meeting record.",
        meetingId: null,
        meetUrl,
      };
    }

    await supabase.from("meeting_participants").insert({
      meeting_id: data.id,
      name: "You",
      role: "Host",
    });

    revalidatePath("/dashboard");
    return {
      error: null,
      meetingId: data.id,
      meetUrl,
      usedMeetApi,
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not create Google Meet",
      meetingId: null,
      meetUrl: null,
    };
  }
}
