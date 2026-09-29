import { NextResponse } from "next/server";
import { getValidGoogleAccessToken } from "@/lib/google/calendar";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ meetingId: string }>;
};

/**
 * Streams the Meet recording MP4 from Google Drive using the user's OAuth token.
 */
export async function GET(request: Request, context: RouteContext) {
  const { meetingId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: meeting } = await supabase
    .from("meetings")
    .select(
      "id, user_id, recording_drive_file_id, recording_state, recording_export_uri"
    )
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting || meeting.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!meeting.recording_drive_file_id) {
    return NextResponse.json(
      { error: "No recording attached to this meeting yet." },
      { status: 404 }
    );
  }

  const { token, error: tokenError } = await getValidGoogleAccessToken(user.id);
  if (!token) {
    return NextResponse.json(
      { error: tokenError ?? "Google not connected" },
      { status: 401 }
    );
  }

  const fileId = meeting.recording_drive_file_id;

  // Confirm file is reachable and get mime/size before streaming media
  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaRes.ok) {
    const detail = await metaRes.text();
    const apiDisabled =
      /accessNotConfigured|has not been used|disabled|Drive API/i.test(detail);
    return NextResponse.json(
      {
        error: apiDisabled
          ? "Google Drive API is not enabled on this Cloud project."
          : `Drive metadata failed (${metaRes.status}).`,
        code: apiDisabled ? "drive_api_disabled" : "drive_forbidden",
        detail: detail.slice(0, 300),
        openInDrive: meeting.recording_export_uri,
      },
      { status: metaRes.status === 403 ? 403 : 502 }
    );
  }

  const meta = (await metaRes.json()) as {
    mimeType?: string;
    size?: string;
    name?: string;
  };

  const range = request.headers.get("range");
  const driveUrl = new URL(
    `https://www.googleapis.com/drive/v3/files/${fileId}`
  );
  driveUrl.searchParams.set("alt", "media");
  driveUrl.searchParams.set("supportsAllDrives", "true");

  const driveRes = await fetch(driveUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(range ? { Range: range } : {}),
    },
  });

  if (!driveRes.ok && driveRes.status !== 206) {
    const body = await driveRes.text();
    return NextResponse.json(
      {
        error: `Drive download failed (${driveRes.status})`,
        detail: body.slice(0, 300),
        openInDrive: meeting.recording_export_uri,
      },
      { status: driveRes.status === 404 ? 404 : 502 }
    );
  }

  // Buffer for short Meet demos — avoids flaky streamed bodies in <video>
  const buffer = Buffer.from(await driveRes.arrayBuffer());

  const headers = new Headers();
  headers.set("Content-Type", meta.mimeType || "video/mp4");
  headers.set("Content-Length", String(buffer.byteLength));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=120");
  if (meta.name) {
    headers.set(
      "Content-Disposition",
      `inline; filename="${meta.name.replace(/"/g, "")}"`
    );
  }

  if (range) {
    // Simple full-buffer range response for browser seekers
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : buffer.byteLength - 1;
      const slice = buffer.subarray(start, end + 1);
      headers.set("Content-Length", String(slice.byteLength));
      headers.set(
        "Content-Range",
        `bytes ${start}-${start + slice.byteLength - 1}/${buffer.byteLength}`
      );
      return new NextResponse(slice, { status: 206, headers });
    }
  }

  return new NextResponse(buffer, { status: 200, headers });
}
