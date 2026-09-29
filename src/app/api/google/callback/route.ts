import { NextRequest, NextResponse } from "next/server";
import { getGoogleClientConfig } from "@/lib/google/config";
import {
  exchangeCodeForTokens,
  fetchGoogleProfile,
} from "@/lib/google/oauth";
import { createClient } from "@/lib/supabase/server";
import { GOOGLE_SCOPES } from "@/lib/google/config";

function appRedirect(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(path, base));
}

export async function GET(request: NextRequest) {
  const { configured } = getGoogleClientConfig();
  if (!configured) {
    return appRedirect("/settings/integrations?error=google_not_configured");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const savedState = request.cookies.get("google_oauth_state")?.value;

  if (oauthError) {
    return appRedirect(
      `/settings/integrations?error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !state || !savedState || state !== savedState) {
    return appRedirect("/settings/integrations?error=invalid_oauth_state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return appRedirect("/auth/login");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleProfile(tokens.access_token);
    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    const { data: existing } = await supabase
      .from("google_integrations")
      .select("id, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const payload = {
      user_id: user.id,
      google_email: profile.email ?? null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
      token_expires_at: tokenExpiresAt,
      scopes: GOOGLE_SCOPES.split(" "),
    };

    if (existing) {
      await supabase
        .from("google_integrations")
        .update(payload)
        .eq("user_id", user.id);
    } else {
      await supabase.from("google_integrations").insert(payload);
    }

    const response = appRedirect("/settings/integrations?connected=1");
    response.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "google_connect_failed";
    return appRedirect(
      `/settings/integrations?error=${encodeURIComponent(message.slice(0, 120))}`
    );
  }
}
