"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { toggleActionItemStatus } from "@/lib/meetings/actions";
import { formatTimestamp } from "@/lib/meetings/format";
import type { MeetingActionItem } from "@/lib/types/database";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type ActionItemsListProps = {
  meetingId: string;
  items: MeetingActionItem[];
  onJumpToTimestamp?: (seconds: number) => void;
};

export function ActionItemsList({
  meetingId,
  items,
  onJumpToTimestamp,
}: ActionItemsListProps) {
  const [pending, startTransition] = useTransition();

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">No action items extracted.</p>
    );
  }

  function onToggle(item: MeetingActionItem) {
    startTransition(async () => {
      const result = await toggleActionItemStatus(item.id, meetingId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.status === "completed" ? "Marked complete" : "Marked pending"
      );
    });
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const done = item.status === "completed";
        return (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-3"
          >
            <Checkbox
              checked={done}
              disabled={pending}
              onCheckedChange={() => onToggle(item)}
              className="mt-0.5"
              aria-label={`Mark ${item.task} ${done ? "pending" : "complete"}`}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p
                className={cn(
                  "text-sm font-medium leading-snug",
                  done && "text-muted-foreground line-through"
                )}
              >
                {item.task}
              </p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {item.assignee ? <span>{item.assignee}</span> : null}
                {item.due_date ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Due {item.due_date}</span>
                  </>
                ) : null}
                {item.timestamp_seconds != null ? (
                  <>
                    <span aria-hidden>·</span>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() =>
                        onJumpToTimestamp?.(Number(item.timestamp_seconds))
                      }
                    >
                      {formatTimestamp(Number(item.timestamp_seconds))}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
