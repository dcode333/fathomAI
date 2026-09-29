import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";
import { getGoogleClientConfig } from "@/lib/google/config";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { configured } = getGoogleClientConfig();
  if (!configured) {
    return NextResponse.redirect(
      new URL(
        "/settings/integrations?error=google_not_configured",
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      )
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(
        "/auth/login",
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      )
    );
  }

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, nonce: crypto.randomUUID() })
  ).toString("base64url");

  const url = buildGoogleAuthUrl(state);
  const response = NextResponse.redirect(url);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
