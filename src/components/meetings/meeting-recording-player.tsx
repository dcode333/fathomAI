"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CloudDownload,
  ExternalLink,
  Loader2,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchGoogleMeetRecording } from "@/lib/meetings/ai-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MeetingRecordingPlayerProps = {
  meetingId: string;
  source: string;
  recordingDriveFileId: string | null;
  recordingExportUri: string | null;
  recordingState: string | null;
  durationLabel: string;
  seekRequest: { token: number; seconds: number } | null;
  onTimeUpdate: (seconds: number) => void;
  className?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function MeetingRecordingPlayer({
  meetingId,
  source,
  recordingDriveFileId,
  recordingExportUri,
  recordingState,
  durationLabel,
  seekRequest,
  onTimeUpdate,
  className,
}: MeetingRecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const hasRecording =
    Boolean(recordingDriveFileId) && recordingState === "FILE_GENERATED";

  const drivePreviewUrl = recordingDriveFileId
    ? `https://drive.google.com/file/d/${recordingDriveFileId}/preview`
    : recordingExportUri;

  // Prefer Drive embed (works with browser Google login). Upgrade to synced
  // <video> if Drive API download succeeds.
  useEffect(() => {
    if (!hasRecording || !recordingDriveFileId) {
      setVideoUrl(null);
      setSyncHint(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoadingVideo(true);
    setSyncHint(null);

    (async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/recording`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
            code?: string;
          } | null;
          if (!cancelled) {
            setSyncHint(
              body?.code === "drive_api_disabled"
                ? "Enable Google Drive API in Cloud Console for transcript-synced seeking."
                : "Playing via Drive. Enable Drive API + reconnect for synced seeking."
            );
          }
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (!blob.size) return;
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
        setSyncHint(null);
      } catch {
        if (!cancelled) {
          setSyncHint("Playing via Drive embed.");
        }
      } finally {
        if (!cancelled) setLoadingVideo(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasRecording, meetingId, recordingDriveFileId]);

  useEffect(() => {
    if (!seekRequest || !videoRef.current || !videoUrl) return;
    const video = videoRef.current;
    const target = Math.max(0, seekRequest.seconds);
    const seek = () => {
      video.currentTime = target;
      void video.play().catch(() => {});
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
  }, [seekRequest, videoUrl]);

  useEffect(() => {
    if (source !== "google_meet" || hasRecording) return;

    let cancelled = false;

    (async () => {
      for (let n = 1; n <= 12; n++) {
        if (cancelled) return;
        setAutoNote(`Looking for recording… (${n}/12)`);
        const result = await fetchGoogleMeetRecording(meetingId);
        if (cancelled) return;

        if (!result.error && result.hasRecording) {
          setAutoNote(null);
          toast.success("Recording ready");
          router.refresh();
          return;
        }

        if (result.retryable === false) {
          setAutoNote(result.error);
          return;
        }

        setAutoNote(result.error ?? "Recording not ready yet");
        await sleep(Math.min(25_000 + n * 2_000, 45_000));
      }
      if (!cancelled) {
        setAutoNote("Recording still processing — use Fetch recording later.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, hasRecording, meetingId, router]);

  function onFetchRecording() {
    startTransition(async () => {
      const result = await fetchGoogleMeetRecording(meetingId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Recording attached — playback ready");
      router.refresh();
    });
  }

  if (hasRecording) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-white/10 bg-black",
          className
        )}
      >
        {loadingVideo && !drivePreviewUrl ? (
          <div className="flex aspect-video items-center justify-center gap-2 text-sm text-white/60">
            <Loader2 className="size-4 animate-spin" />
            Loading recording…
          </div>
        ) : videoUrl ? (
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            controls
            playsInline
            preload="metadata"
            src={videoUrl}
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          />
        ) : drivePreviewUrl ? (
          <iframe
            title="Meet recording"
            src={drivePreviewUrl}
            className="aspect-video w-full border-0 bg-black"
            allow="autoplay"
            allowFullScreen
          />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 p-4 text-center">
            <p className="max-w-[260px] text-xs text-white/55">
              Recording file is missing a playable link.
            </p>
            {recordingExportUri ? (
              <a
                href={recordingExportUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
              >
                Open in Drive
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        )}
        <div className="space-y-1 border-t border-white/10 bg-[#0e1118] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/45">
              {videoUrl
                ? `Synced with transcript · ${durationLabel}`
                : `Drive player · ${durationLabel}`}
            </p>
            {recordingExportUri ? (
              <a
                href={recordingExportUri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-sky-300 hover:underline"
              >
                Open in Drive
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
          {syncHint && !videoUrl ? (
            <p className="text-[10px] text-white/35">
              {syncHint}{" "}
              <a
                href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="text-sky-300/80 hover:underline"
              >
                Open Drive API
              </a>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950",
        className
      )}
    >
      <div className="relative aspect-video">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.25),transparent_55%)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
            {source === "google_meet" && !hasRecording ? (
              <Loader2 className="size-5 animate-spin text-white/70" />
            ) : (
              <Video className="size-5 text-white/70" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/80">
              {source === "google_meet"
                ? "Google Meet recording"
                : "Demo recording"}
            </p>
            <p className="max-w-[240px] text-xs text-white/45">
              {source === "google_meet"
                ? autoNote ||
                  (recordingState && recordingState !== "FILE_GENERATED"
                    ? `Google is still processing (${recordingState}).`
                    : "Waiting for Meet recording…")
                : "Demo meetings don’t include video — timestamps still jump the transcript."}
            </p>
          </div>
          {source === "google_meet" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={onFetchRecording}
              disabled={pending}
              className="bg-white/10 text-white hover:bg-white/15"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudDownload className="size-3.5" />
              )}
              Fetch recording now
            </Button>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/50 px-3 py-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15" />
          <span className="font-mono text-[10px] text-white/60">{durationLabel}</span>
        </div>
      </div>
    </div>
  );
}
