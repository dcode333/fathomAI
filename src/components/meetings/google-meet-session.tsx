"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CloudDownload,
  ExternalLink,
  Loader2,
  Radio,
  Square,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  checkGoogleMeetEnded,
  fetchGoogleMeetTranscriptAndAnalyze,
  importTranscriptAndAnalyze,
} from "@/lib/meetings/ai-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type GoogleMeetSessionProps = {
  meetingId: string;
  meetingUrl: string | null;
  title: string;
};

const SAMPLE = `Sarah: We'd like to have the new dashboard ready by October 15th.
Umair: That works. I'll prioritize the payment integration first.
John: Stripe is the most important part for launch. Reporting can come later.
Umair: I'll have the first version ready next week.
Sarah: Perfect. I'll send the Stripe credentials today.`;

const WATCH_STORAGE_KEY = (id: string) => `fathom-watch-end:${id}`;
const IMPORT_STORAGE_KEY = (id: string) => `fathom-auto-import:${id}`;
const MAX_IMPORT_ATTEMPTS = 24;
const END_CHECK_MS = 15_000;
const BASE_IMPORT_MS = 20_000;

type Phase = "idle" | "watching_end" | "importing";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GoogleMeetSession({
  meetingId,
  meetingUrl,
  title,
}: GoogleMeetSessionProps) {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "fetch" | "paste">("idle");
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const stopRef = useRef(false);

  // Resume watch/import after refresh
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(IMPORT_STORAGE_KEY(meetingId)) === "1") {
      setPhase("importing");
    } else if (sessionStorage.getItem(WATCH_STORAGE_KEY(meetingId)) === "1") {
      setPhase("watching_end");
    } else if (meetingUrl) {
      // Default: start watching for Meet end as soon as this page is open
      setPhase("watching_end");
    }
  }, [meetingId, meetingUrl]);

  // Phase 1 — detect conference endTime from Google Meet API
  useEffect(() => {
    if (phase !== "watching_end" || !meetingUrl) return;

    stopRef.current = false;
    sessionStorage.setItem(WATCH_STORAGE_KEY(meetingId), "1");
    sessionStorage.removeItem(IMPORT_STORAGE_KEY(meetingId));
    setLastStatus("Watching for the Meet to end…");

    (async () => {
      while (!stopRef.current) {
        const status = await checkGoogleMeetEnded(meetingId);
        if (stopRef.current) return;

        if (status.error && !status.found) {
          setLastStatus(status.error);
          // Soft errors (not connected yet / no record): keep watching
        } else if (status.ended) {
          setLastStatus("Meet ended — starting auto-import…");
          toast.message("Meet ended — importing transcript & recording");
          sessionStorage.removeItem(WATCH_STORAGE_KEY(meetingId));
          setPhase("importing");
          return;
        } else if (status.found) {
          setLastStatus("Meet is still in progress — waiting for it to end…");
        } else {
          setLastStatus(
            "No conference yet — join the Meet and end it when you’re done."
          );
        }

        await sleep(END_CHECK_MS);
      }
    })();

    return () => {
      stopRef.current = true;
    };
  }, [phase, meetingId, meetingUrl]);

  // Phase 2 — poll until transcript (+ recording) is ready
  useEffect(() => {
    if (phase !== "importing" || !meetingUrl) return;

    stopRef.current = false;
    sessionStorage.setItem(IMPORT_STORAGE_KEY(meetingId), "1");
    sessionStorage.removeItem(WATCH_STORAGE_KEY(meetingId));

    (async () => {
      for (let n = 1; n <= MAX_IMPORT_ATTEMPTS; n++) {
        if (stopRef.current) return;

        setAttempt(n);
        setLastStatus("Checking Google for transcript / recording…");

        const result = await fetchGoogleMeetTranscriptAndAnalyze(meetingId);
        if (stopRef.current) return;

        if (!result.error) {
          sessionStorage.removeItem(IMPORT_STORAGE_KEY(meetingId));
          setPhase("idle");
          setLastStatus(null);
          toast.success(
            result.hasRecording
              ? "Ready — transcript + recording imported"
              : "Ready — transcript imported (recording may still be processing)"
          );
          router.refresh();
          return;
        }

        if (result.retryable === false) {
          sessionStorage.removeItem(IMPORT_STORAGE_KEY(meetingId));
          setPhase("idle");
          setLastStatus(result.error);
          toast.error(result.error);
          return;
        }

        setLastStatus(result.error);

        if (n === MAX_IMPORT_ATTEMPTS) {
          sessionStorage.removeItem(IMPORT_STORAGE_KEY(meetingId));
          setPhase("idle");
          toast.message(
            "Google is still processing. Tap Auto-import again in a few minutes."
          );
          return;
        }

        await sleep(Math.min(BASE_IMPORT_MS + n * 2_000, 45_000));
      }
    })();

    return () => {
      stopRef.current = true;
    };
  }, [phase, meetingId, meetingUrl, router]);

  function startWatching() {
    setAttempt(0);
    setLastStatus(null);
    setPhase("watching_end");
  }

  function startImportNow() {
    setAttempt(0);
    setLastStatus(null);
    setPhase("importing");
  }

  function stopAll() {
    stopRef.current = true;
    sessionStorage.removeItem(WATCH_STORAGE_KEY(meetingId));
    sessionStorage.removeItem(IMPORT_STORAGE_KEY(meetingId));
    setPhase("idle");
    setLastStatus("Paused");
  }

  function onFetchOnce() {
    setMode("fetch");
    startTransition(async () => {
      const result = await fetchGoogleMeetTranscriptAndAnalyze(meetingId);
      setMode("idle");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      sessionStorage.removeItem(WATCH_STORAGE_KEY(meetingId));
      sessionStorage.removeItem(IMPORT_STORAGE_KEY(meetingId));
      setPhase("idle");
      toast.success(
        result.hasRecording
          ? "Transcript + recording fetched"
          : "Transcript fetched (no recording yet)"
      );
      router.refresh();
    });
  }

  function onImport() {
    setMode("paste");
    startTransition(async () => {
      const result = await importTranscriptAndAnalyze(meetingId, transcript);
      setMode("idle");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.provider === "openai"
          ? "Analyzed with OpenAI"
          : "Analyzed with local analyzer"
      );
      router.refresh();
    });
  }

  const busy = phase === "watching_end" || phase === "importing";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Video className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="text-lg font-semibold tracking-tight">
                Google Meet linked
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep this page open. We detect when the Meet ends, then
                auto-import transcript and recording — no manual fetch loop.
              </p>
            </div>
            {meetingUrl ? (
              <a
                href={meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open {title || "Google Meet"}
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}

            <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
              <li>Open the Meet link and join.</li>
              <li>
                Start <strong>Recording</strong> and{" "}
                <strong>Transcript / Take notes</strong>.
              </li>
              <li>End the call — we notice and import automatically.</li>
            </ol>

            <div className="flex flex-wrap gap-2">
              {busy ? (
                <Button variant="outline" onClick={stopAll}>
                  <Square className="size-4" />
                  Pause
                </Button>
              ) : (
                <Button onClick={startWatching} disabled={!meetingUrl || pending}>
                  <Radio className="size-4" />
                  Watch for Meet end
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={startImportNow}
                disabled={!meetingUrl || pending || phase === "importing"}
              >
                Import now
              </Button>
              <Button
                variant="ghost"
                onClick={onFetchOnce}
                disabled={pending || busy || !meetingUrl}
              >
                {pending && mode === "fetch" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CloudDownload className="size-4" />
                )}
                Fetch once
              </Button>
            </div>

            {busy ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  {phase === "watching_end"
                    ? "Watching for Meet to end"
                    : `Auto-import · check ${attempt}/${MAX_IMPORT_ATTEMPTS}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lastStatus ?? "Working…"}
                </p>
              </div>
            ) : lastStatus ? (
              <p className="text-xs text-muted-foreground">{lastStatus}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Detection uses Google&apos;s conference end time (same Meet API).
                Leave this tab open during the call.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-1">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or paste manually</span>
        <Separator className="flex-1" />
      </div>

      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Label htmlFor="transcript-import" className="text-base font-semibold">
            Paste transcript
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTranscript(SAMPLE)}
            disabled={pending || busy}
          >
            Use sample
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Format: <code className="text-xs">Speaker: what they said</code>
        </p>
        <textarea
          id="transcript-import"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={pending || busy}
          rows={10}
          placeholder={SAMPLE}
          className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button
          className="mt-4 w-full"
          onClick={onImport}
          disabled={pending || busy || !transcript.trim()}
        >
          {pending && mode === "paste" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Analyze pasted transcript
        </Button>
      </div>
    </div>
  );
}
