import { refreshAccessToken } from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";

export async function getValidGoogleAccessToken(userId: string) {
  const supabase = await createClient();
  const { data: integration } = await supabase
    .from("google_integrations")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!integration?.access_token) {
    return { token: null, integration: null, error: "Google is not connected." };
  }

  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at).getTime()
    : 0;
  const stillValid = expiresAt - Date.now() > 60_000;

  if (stillValid) {
    return { token: integration.access_token, integration, error: null };
  }

  if (!integration.refresh_token) {
    return {
      token: null,
      integration,
      error: "Google session expired. Reconnect Google in Settings.",
    };
  }

  try {
    const refreshed = await refreshAccessToken(integration.refresh_token);
    const tokenExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();

    await supabase
      .from("google_integrations")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: tokenExpiresAt,
      })
      .eq("user_id", userId);

    return { token: refreshed.access_token, integration, error: null };
  } catch (err) {
    return {
      token: null,
      integration,
      error:
        err instanceof Error
          ? err.message
          : "Could not refresh Google access token.",
    };
  }
}

export async function createGoogleMeetEvent(options: {
  accessToken: string;
  title: string;
  start?: Date;
  durationMinutes?: number;
}) {
  const start = options.start ?? new Date();
  const end = new Date(
    start.getTime() + (options.durationMinutes ?? 30) * 60_000
  );

  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: options.title,
        description: "Created by Fathom AI demo notetaker",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Calendar API error: ${body.slice(0, 400)}`);
  }

  const event = (await response.json()) as {
    id?: string;
    hangoutLink?: string;
    htmlLink?: string;
    conferenceData?: {
      entryPoints?: { entryPointType?: string; uri?: string }[];
    };
  };

  const meetUrl =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
      ?.uri ||
    null;

  if (!meetUrl) {
    throw new Error(
      "Google created the calendar event but did not return a Meet link. Ensure Meet is enabled on this Google account."
    );
  }

  return {
    meetUrl,
    eventId: event.id ?? null,
    htmlLink: event.htmlLink ?? null,
  };
}
