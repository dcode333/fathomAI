import { ensureDashboardSeed } from "@/lib/meetings/actions";
import { getMeetingsForUser } from "@/lib/meetings/queries";
import { getGoogleConnectionStatus } from "@/lib/google/actions";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { NewMeetingDialog } from "@/components/meetings/new-meeting-dialog";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await ensureDashboardSeed();
  const google = await getGoogleConnectionStatus();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const firstName =
    profile?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "there";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const meetings = await getMeetingsForUser(user!.id, q);
  const actionItemsCount = meetings.reduce(
    (sum, m) => sum + (m.meeting_action_items?.length ?? 0),
    0
  );
  const hoursRecorded =
    Math.round(
      (meetings.reduce((sum, m) => sum + (m.duration_seconds ?? 0), 0) / 3600) *
        10
    ) / 10;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Your calls, summaries, and action items — ready when the meeting
            ends.
          </p>
        </div>
        <NewMeetingDialog
          triggerClassName="self-start sm:self-auto"
          googleConnected={google.connected}
        />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {meetings.length}
          </span>{" "}
          meetings
        </span>
        <span aria-hidden className="text-border">
          ·
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {actionItemsCount}
          </span>{" "}
          action items
        </span>
        <span aria-hidden className="text-border">
          ·
        </span>
        <span>
          <span className="font-semibold tabular-nums text-foreground">
            {hoursRecorded}
          </span>{" "}
          hours recorded
        </span>
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Recent meetings
          </h2>
          {q ? (
            <p className="text-sm text-muted-foreground">
              Results in titles, summaries, transcripts & actions for “{q}”
            </p>
          ) : null}
        </div>

        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/70 px-6 py-20 text-center">
            <p className="text-base font-medium">
              {q ? "No matches found" : "No meetings yet"}
            </p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {q
                ? "Try another keyword — search covers titles, summaries, transcript lines, and action items."
                : "Start a Google Meet notetaker or run Demo Meeting to see the full intelligence pipeline."}
            </p>
            {!q ? (
              <div className="mt-6">
                <NewMeetingDialog googleConnected={google.connected} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4">
            {meetings.map((meeting, index) => (
              <MeetingCard key={meeting.id} meeting={meeting} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
