"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Circle,
  Loader2,
  Radio,
  Sparkles,
  Square,
  Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { completeDemoMeeting } from "@/lib/meetings/ai-actions";
import { createMeetingHighlight } from "@/lib/meetings/highlight-actions";
import {
  WEBSITE_REDESIGN_DEMO,
} from "@/lib/meetings/demo-scenario";
import { formatTimestamp } from "@/lib/meetings/format";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "received", label: "Meeting received" },
  { id: "transcript", label: "Transcript generated" },
  { id: "speakers", label: "Speakers identified" },
  { id: "analyzing", label: "Analyzing conversation" },
  { id: "actions", label: "Extracting action items" },
  { id: "summary", label: "Generating summary" },
] as const;

const LINE_MS = 1700;
const STEP_MS = 550;

type Phase = "recording" | "processing" | "saving" | "ready" | "error";

type DemoMeetingSessionProps = {
  meetingId: string;
  initialStatus: string;
};

export function DemoMeetingSession({
  meetingId,
  initialStatus,
}: DemoMeetingSessionProps) {
  const router = useRouter();
  const scenario = WEBSITE_REDESIGN_DEMO;
  const [phase, setPhase] = useState<Phase>(
    initialStatus === "processing" ? "processing" : "recording"
  );
  const [visibleCount, setVisibleCount] = useState(
    initialStatus === "processing" ? scenario.transcript.length : 0
  );
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [highlightCount, setHighlightCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const processingStarted = useRef(false);

  const visibleLines = scenario.transcript.slice(0, visibleCount);
  const isLive = phase === "recording";

  // Stream transcript lines during the "live" meeting
  useEffect(() => {
    if (phase !== "recording") return;
    if (visibleCount >= scenario.transcript.length) return;

    const t = setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 1, scenario.transcript.length));
    }, LINE_MS);

    return () => clearTimeout(t);
  }, [phase, visibleCount, scenario.transcript.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibleCount]);

  // After all lines (optional auto-prompt) — user still ends manually, but we hint
  const allLinesIn = visibleCount >= scenario.transcript.length;

  function beginProcessing() {
    setPhase("processing");
  }

  function endMeeting() {
    // Jump to full transcript for a complete analysis
    setVisibleCount(scenario.transcript.length);
    beginProcessing();
  }

  // Processing step animation → persist to DB
  useEffect(() => {
    if (phase !== "processing" || processingStarted.current) return;
    processingStarted.current = true;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) setActiveStep(index);
        }, index * STEP_MS)
      );
    });

    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        setPhase("saving");
        startTransition(async () => {
          const result = await completeDemoMeeting(meetingId);
          if (cancelled) return;
          if (result.error) {
            setError(result.error);
            setPhase("error");
            toast.error(result.error);
            return;
          }
          setPhase("ready");
          setTimeout(() => {
            if (!cancelled) router.refresh();
          }, 800);
        });
      }, STEPS.length * STEP_MS + 150)
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [phase, meetingId, router]);

  function highlightCurrentLine() {
    const line = visibleLines.at(-1);
    if (!line) {
      toast.message("Wait for a line of conversation first");
      return;
    }
    startTransition(async () => {
      const result = await createMeetingHighlight({
        meetingId,
        timestampSeconds: line.start_time,
        quote: line.text,
        speaker: line.speaker,
        source: "live",
        note: "Pinned during the call",
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setHighlightCount((n) => n + 1);
      toast.success(`Highlighted at ${formatTimestamp(line.start_time)}`);
    });
  }

  function retry() {
    processingStarted.current = false;
    setError(null);
    setActiveStep(0);
    setPhase("processing");
  }

  if (phase === "ready") {
    return (
      <ReadyState message="Your meeting notes are ready" />
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border/70 bg-card px-6 py-12 text-center shadow-sm">
        <p className="text-lg font-semibold">We couldn&apos;t analyze this meeting</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Something went wrong."}
        </p>
        <Button className="mt-6" onClick={retry} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Retry Analysis
        </Button>
      </div>
    );
  }

  if (phase === "processing" || phase === "saving") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Processing meeting…
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              The conversation you just watched is being turned into summary,
              decisions, and action items.
            </p>
          </div>
        </div>
        <ol className="space-y-3">
          {STEPS.map((step, index) => {
            const done = phase === "saving" || index < activeStep;
            const current = phase === "processing" && index === activeStep;
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                  current && "bg-accent/60",
                  !done && !current && "text-muted-foreground"
                )}
              >
                <span className="flex size-6 items-center justify-center">
                  {done ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : current ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <Circle className="size-5 text-border" />
                  )}
                </span>
                <span className={cn(done && "font-medium")}>{step.label}</span>
              </li>
            );
          })}
        </ol>
        {phase === "saving" ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Saving meeting intelligence…
          </p>
        ) : null}
      </div>
    );
  }

  // Live recording simulation
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white sm:px-5">
        <div className="flex items-center gap-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">
              AI Notetaker · Recording
            </p>
            <p className="text-xs text-white/65">
              Simulated Google Meet · Demo Mode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!isLive || visibleLines.length === 0 || pending}
            onClick={highlightCurrentLine}
            className="bg-white/10 text-white hover:bg-white/15"
          >
            <Bookmark className="size-3.5" />
            Highlight
            {highlightCount > 0 ? ` (${highlightCount})` : ""}
          </Button>
          <Radio className="size-3.5 text-red-400" />
          <span className="font-mono text-xs text-white/80">
            {formatTimestamp(
              visibleLines.at(-1)?.start_time ?? 0
            )}
          </span>
        </div>
      </div>

      <div className="border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          In this call
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {scenario.participants.map((p) => (
            <span
              key={p.name}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {p.name[0]}
              </span>
              {p.name}
              <span className="text-muted-foreground">· {p.role}</span>
            </span>
          ))}
        </div>
      </div>

      <ScrollArea className="h-[min(52vh,480px)]">
        <div className="space-y-1 p-4 sm:p-5">
          {visibleLines.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Waiting for conversation to start…
            </p>
          ) : (
            visibleLines.map((line) => (
              <article
                key={line.sequence}
                className="animate-in fade-in slide-in-from-bottom-1 rounded-xl px-3 py-3 duration-300 sm:px-4"
              >
                <div className="mb-1 flex items-center gap-3">
                  <span className="font-mono text-xs font-medium text-primary">
                    {formatTimestamp(line.start_time)}
                  </span>
                  <span className="text-sm font-semibold">{line.speaker}</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {line.text}
                </p>
              </article>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex flex-col gap-3 border-t border-border/70 bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-sm text-muted-foreground">
          {allLinesIn
            ? "Conversation finished — end the meeting to generate notes."
            : "Watch the live transcript. This is a scripted demo call (not a real Meet)."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!allLinesIn ? (
            <Button
              variant="outline"
              onClick={() => setVisibleCount(scenario.transcript.length)}
            >
              Skip ahead
            </Button>
          ) : null}
          <Button onClick={endMeeting} className="gap-2">
            <Square className="size-3.5 fill-current" />
            End Meeting
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReadyState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-border/70 bg-card px-6 py-14 text-center shadow-sm">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-6" strokeWidth={2.5} />
      </div>
      <p className="text-lg font-semibold tracking-tight">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">Opening intelligence…</p>
    </div>
  );
}
