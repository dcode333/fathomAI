import Link from "next/link";
import { CheckCircle2, CircleDashed, Clock3, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatDuration,
  formatMeetingWhen,
  participantNames,
  statusLabel,
  type MeetingListItem,
} from "@/lib/meetings/format";
import { cn } from "@/lib/utils";

const thumbGradients = [
  "from-sky-700/90 via-teal-600/80 to-cyan-500/70",
  "from-slate-700/90 via-sky-800/80 to-teal-600/70",
  "from-cyan-800/90 via-slate-700/80 to-sky-600/70",
];

type MeetingCardProps = {
  meeting: MeetingListItem;
  index?: number;
};

export function MeetingCard({ meeting, index = 0 }: MeetingCardProps) {
  const when = formatMeetingWhen(meeting.started_at ?? meeting.created_at);
  const duration = formatDuration(meeting.duration_seconds);
  const people = participantNames(meeting.meeting_participants ?? []);
  const actionCount = meeting.meeting_action_items?.length ?? 0;
  const decisionCount = meeting.meeting_decisions?.length ?? 0;
  const isReady = meeting.status === "completed";
  const gradient = thumbGradients[index % thumbGradients.length];

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className={cn(
        "group grid gap-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        "sm:grid-cols-[148px_1fr]"
      )}
    >
      <div
        className={cn(
          "relative min-h-[112px] bg-gradient-to-br p-4 text-white sm:min-h-full",
          gradient
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,white/15,transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-between">
          <Badge
            variant="secondary"
            className="w-fit border-0 bg-white/15 text-white backdrop-blur-sm"
          >
            {statusLabel(meeting.status)}
          </Badge>
          <div className="space-y-0.5">
            <p className="text-xs text-white/75">
              {when} · {duration}
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-white/60">
              {meeting.source === "google_meet" ? "Google Meet" : "Demo"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-3 p-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary">
            {meeting.title}
          </h3>
          <p className="text-sm text-muted-foreground">{people}</p>
        </div>

        {meeting.search_match ? (
          <p className="line-clamp-2 rounded-lg bg-primary/5 px-2.5 py-2 text-sm leading-relaxed text-foreground/80">
            <span className="mr-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
              {meeting.search_match.source.replace("_", " ")}
            </span>
            {meeting.search_match.snippet}
          </p>
        ) : isReady && meeting.meeting_analysis?.summary ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {meeting.meeting_analysis.summary}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {meeting.status === "processing" ? (
              <>
                <CircleDashed className="size-3.5 animate-spin" />
                Analyzing conversation…
              </>
            ) : meeting.status === "joining" || meeting.status === "recording" ? (
              <>
                <Clock3 className="size-3.5" />
                AI notetaker is tracking this meeting
              </>
            ) : (
              "Notes will appear when the meeting is ready"
            )}
          </p>
        )}

        {isReady ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ListTodo className="size-3.5 text-primary" />
              {actionCount} action {actionCount === 1 ? "item" : "items"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-primary" />
              {decisionCount}{" "}
              {decisionCount === 1 ? "decision" : "decisions"}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
