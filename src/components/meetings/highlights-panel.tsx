"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createClipFromHighlight,
  deleteMeetingHighlight,
} from "@/lib/meetings/highlight-actions";
import { formatTimestamp } from "@/lib/meetings/format";
import type { MeetingHighlight } from "@/lib/types/database";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HighlightsPanelProps = {
  meetingId: string;
  highlights: MeetingHighlight[];
  onJumpToTimestamp?: (seconds: number) => void;
  className?: string;
};

export function HighlightsPanel({
  meetingId,
  highlights,
  onJumpToTimestamp,
  className,
}: HighlightsPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onShare(highlightId: string) {
    startTransition(async () => {
      const result = await createClipFromHighlight(meetingId, highlightId);
      if (result.error || !result.url) {
        toast.error(result.error ?? "Could not create share link");
        return;
      }
      await navigator.clipboard.writeText(result.url);
      toast.success("Clip link copied — anyone with the link can view it");
      router.refresh();
    });
  }

  function onDelete(highlightId: string) {
    startTransition(async () => {
      const result = await deleteMeetingHighlight(meetingId, highlightId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Highlight removed");
      router.refresh();
    });
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white/90">
          Highlights ({highlights.length})
        </h2>
      </div>

      {highlights.length === 0 ? (
        <p className="text-sm text-white/45">
          Star a line in the transcript (or during Demo Meeting) to pin a
          moment here. Then share it as a clip link.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {highlights.map((h) => (
            <li
              key={h.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onJumpToTimestamp?.(Number(h.timestamp_seconds))
                  }
                  className="font-mono text-xs font-medium text-sky-300 hover:underline"
                >
                  {formatTimestamp(Number(h.timestamp_seconds))}
                </button>
                {h.speaker ? (
                  <span className="text-xs font-medium text-white/55">
                    {h.speaker}
                  </span>
                ) : null}
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/45">
                  {h.source === "live" ? "Live" : "Review"}
                </span>
              </div>
              <p className="text-[15px] leading-relaxed text-white/80">
                “{h.quote}”
              </p>
              {h.note ? (
                <p className="mt-1 text-xs text-white/45">{h.note}</p>
              ) : null}
              <div className="mt-2 flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onShare(h.id)}
                  className="h-7 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                >
                  {pending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Link2 className="size-3" />
                  )}
                  Share clip
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onDelete(h.id)}
                  className="h-7 px-2 text-xs text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="size-3" />
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HighlightBadge() {
  return <Bookmark className="size-3.5" />;
}
