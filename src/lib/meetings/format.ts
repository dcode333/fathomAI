import type { Meeting, MeetingParticipant, MeetingStatus } from "@/lib/types/database";

export type MeetingListItem = Meeting & {
  meeting_participants: Pick<MeetingParticipant, "id" | "name" | "role">[];
  meeting_analysis: { summary: string; template_id?: string | null } | null;
  meeting_action_items: { id: string; status: string }[];
  meeting_decisions: { id: string }[];
  search_match?: { snippet: string; source: string } | null;
};

export function formatTimestamp(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(Number(seconds))) return "0:00";
  const total = Math.max(0, Math.floor(Number(seconds)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatMeetingWhen(iso: string | null | undefined): string {
  if (!iso) return "Scheduled";
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThatDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000
  );

  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function statusLabel(status: MeetingStatus): string {
  switch (status) {
    case "completed":
      return "Ready";
    case "processing":
      return "Analyzing";
    case "recording":
      return "Recording";
    case "joining":
      return "Connecting";
    case "scheduled":
      return "Scheduled";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function participantNames(
  participants: Pick<MeetingParticipant, "name">[]
): string {
  if (!participants.length) return "No participants";
  return participants.map((p) => p.name).join(" · ");
}
