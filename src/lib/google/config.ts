export const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
  // Meet REST API — spaces + conference artifacts/transcripts
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  // Meet recordings / transcript Docs saved to Drive
  "https://www.googleapis.com/auth/drive.meet.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

export const DRIVE_MEET_SCOPE =
  "https://www.googleapis.com/auth/drive.meet.readonly";
export const DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

export function getGoogleClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  return {
    clientId,
    clientSecret,
    appUrl,
    redirectUri: `${appUrl.replace(/\/$/, "")}/api/google/callback`,
    configured: Boolean(clientId && clientSecret),
  };
}

/** meet.google.com/abc-mnop-xyz → abc-mnop-xyz */
export function extractMeetingCode(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /meet\.google\.com\/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/i
  );
  return match?.[1]?.toLowerCase() ?? null;
}
