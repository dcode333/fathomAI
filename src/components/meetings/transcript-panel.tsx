"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createMeetingHighlight,
  createShareClip,
} from "@/lib/meetings/highlight-actions";
import { formatTimestamp } from "@/lib/meetings/format";
import type { MeetingHighlight, TranscriptSegment } from "@/lib/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type TranscriptPanelProps = {
  meetingId: string;
  segments: TranscriptSegment[];
  highlights?: MeetingHighlight[];
  playbackTime?: number | null;
  onSelectTimestamp?: (seconds: number) => void;
};

function findActiveIndex(
  segments: TranscriptSegment[],
  time: number | null | undefined
): number {
  if (time == null || !segments.length) return -1;
  let active = 0;
  for (let i = 0; i < segments.length; i++) {
    if (Number(segments[i].start_time) <= time + 0.05) active = i;
    else break;
  }
  return active;
}

export function TranscriptPanel({
  meetingId,
  segments,
  highlights = [],
  playbackTime = null,
  onSelectTimestamp,
}: TranscriptPanelProps) {
  const router = useRouter();
  const activeRef = useRef<HTMLElement | null>(null);
  const activeIndex = findActiveIndex(segments, playbackTime);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const highlightedStarts = new Set(
    highlights.map((h) => Number(h.timestamp_seconds).toFixed(1))
  );

  useEffect(() => {
    if (activeIndex < 0) return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  function onHighlight(segment: TranscriptSegment) {
    const key = `h-${segment.id}`;
    setPendingKey(key);
    startTransition(async () => {
      const result = await createMeetingHighlight({
        meetingId,
        timestampSeconds: Number(segment.start_time),
        quote: segment.text,
        speaker: segment.speaker,
        source: "review",
      });
      setPendingKey(null);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Moment highlighted");
      router.refresh();
    });
  }

  function onShareClip(segment: TranscriptSegment) {
    const key = `c-${segment.id}`;
    setPendingKey(key);
    startTransition(async () => {
      const result = await createShareClip({
        meetingId,
        quote: segment.text,
        speaker: segment.speaker,
        startSeconds: Number(segment.start_time),
        endSeconds:
          segment.end_time != null ? Number(segment.end_time) : null,
      });
      setPendingKey(null);
      if (result.error || !result.url) {
        toast.error(result.error ?? "Could not create clip");
        return;
      }
      await navigator.clipboard.writeText(result.url);
      toast.success("Clip link copied");
      router.refresh();
    });
  }

  if (!segments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <p className="text-sm font-medium">Transcript is not available yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          It will appear once the meeting finishes processing.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[min(70vh,720px)] rounded-2xl border border-border/70 bg-card">
      <div className="space-y-1 p-4 sm:p-5">
        {segments.map((segment, index) => {
          const isActive = index === activeIndex;
          const isHighlighted = highlightedStarts.has(
            Number(segment.start_time).toFixed(1)
          );

          return (
            <article
              key={segment.id}
              ref={isActive ? activeRef : undefined}
              id={`segment-${segment.sequence}`}
              className={cn(
                "group rounded-xl px-3 py-3 transition-colors sm:px-4",
                isActive
                  ? "bg-accent/80 ring-1 ring-primary/20"
                  : "hover:bg-muted/40",
                isHighlighted && "ring-1 ring-amber-400/30"
              )}
            >
              <div className="mb-1.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onSelectTimestamp?.(Number(segment.start_time))}
                  className="font-mono text-xs font-medium text-primary hover:underline"
                >
                  {formatTimestamp(Number(segment.start_time))}
                </button>
                <span className="text-sm font-semibold tracking-tight">
                  {segment.speaker}
                </span>
                <div className="ml-auto flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    title="Highlight moment"
                    disabled={pending}
                    onClick={() => onHighlight(segment)}
                    className={cn(
                      "rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-amber-500",
                      isHighlighted && "text-amber-500"
                    )}
                  >
                    {pending && pendingKey === `h-${segment.id}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Bookmark
                        className={cn(
                          "size-3.5",
                          isHighlighted && "fill-current"
                        )}
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Share clip link"
                    disabled={pending}
                    onClick={() => onShareClip(segment)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-primary"
                  >
                    {pending && pendingKey === `c-${segment.id}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Link2 className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {segment.text}
              </p>
            </article>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function useTranscriptHighlight() {
  const [activeStartTime, setActiveStartTime] = useState<number | null>(null);
  return { activeStartTime, setActiveStartTime };
}
