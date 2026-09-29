import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DemoMeetingSession } from "@/components/meetings/demo-meeting-session";
import { GoogleMeetSession } from "@/components/meetings/google-meet-session";
import { MeetingIntelligence } from "@/components/meetings/meeting-intelligence";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ensureMeetingIntelligence } from "@/lib/meetings/actions";
import { repairMeetingTranscriptTimestamps } from "@/lib/meetings/ai-actions";
import {
  formatDuration,
  formatMeetingWhen,
  participantNames,
  statusLabel,
} from "@/lib/meetings/format";
import { getMeetingDetail } from "@/lib/meetings/get-meeting";
import { cn } from "@/lib/utils";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;

  await ensureMeetingIntelligence(meetingId);
  await repairMeetingTranscriptTimestamps(meetingId);
  const meeting = await getMeetingDetail(meetingId);

  if (!meeting) {
    notFound();
  }

  const people = participantNames(meeting.meeting_participants);
  const isReady =
    meeting.status === "completed" &&
    (!!meeting.meeting_analysis || meeting.transcript_segments.length > 0);

  if (isReady) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 text-muted-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          Back to My Meetings
        </Link>
        <MeetingIntelligence meeting={meeting} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 text-muted-foreground"
        )}
      >
        <ArrowLeft className="size-4" />
        Back to My Meetings
      </Link>

      <header className="space-y-4 border-b border-border/70 pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{statusLabel(meeting.status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {formatMeetingWhen(meeting.started_at ?? meeting.created_at)} ·{" "}
            {formatDuration(meeting.duration_seconds)}
          </span>
          <span className="text-sm text-muted-foreground">
            · {meeting.source === "google_meet" ? "Google Meet" : "Demo"}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {meeting.title}
        </h1>
        <p className="text-muted-foreground">{people}</p>
      </header>

      {meeting.source === "demo" ? (
        <DemoMeetingSession
          meetingId={meeting.id}
          initialStatus={meeting.status}
        />
      ) : (
        <GoogleMeetSession
          meetingId={meeting.id}
          meetingUrl={meeting.meeting_url}
          title={meeting.title}
        />
      )}
    </div>
  );
}
