import { getGoogleClientConfig, GOOGLE_SCOPES } from "@/lib/google/config";

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri, configured } = getGoogleClientConfig();
  if (!configured || !clientId) {
    throw new Error("Google OAuth is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri, configured } =
    getGoogleClientConfig();
  if (!configured || !clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed: ${body.slice(0, 300)}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret, configured } = getGoogleClientConfig();
  if (!configured || !clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token refresh failed: ${body.slice(0, 300)}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  };
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    throw new Error("Could not fetch Google profile");
  }
  return (await response.json()) as {
    email?: string;
    name?: string;
    picture?: string;
  };
}
