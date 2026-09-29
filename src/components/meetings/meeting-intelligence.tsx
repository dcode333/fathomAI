"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ActionItemsList } from "@/components/meetings/action-items-list";
import { AskMeeting } from "@/components/meetings/ask-meeting";
import { FollowUpEmail } from "@/components/meetings/follow-up-email";
import { HighlightsPanel } from "@/components/meetings/highlights-panel";
import { MeetingRecordingPlayer } from "@/components/meetings/meeting-recording-player";
import { SummaryTemplateSwitcher } from "@/components/meetings/summary-template-switcher";
import { TranscriptPanel } from "@/components/meetings/transcript-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDuration,
  formatMeetingWhen,
  formatTimestamp,
  participantNames,
} from "@/lib/meetings/format";
import type { MeetingDetail } from "@/lib/meetings/get-meeting";

type MeetingIntelligenceProps = {
  meeting: MeetingDetail;
};

export function MeetingIntelligence({ meeting }: MeetingIntelligenceProps) {
  const [tab, setTab] = useState("summary");
  const [activeStartTime, setActiveStartTime] = useState<number | null>(null);
  const [seekRequest, setSeekRequest] = useState<{
    token: number;
    seconds: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const actionCount = meeting.meeting_action_items.length;
  const highlightCount = meeting.meeting_highlights?.length ?? 0;
  const people = participantNames(meeting.meeting_participants);
  const when = formatMeetingWhen(meeting.started_at ?? meeting.created_at);
  const duration = formatDuration(meeting.duration_seconds);

  function jumpToTranscript(seconds: number) {
    setActiveStartTime(seconds);
    setSeekRequest((prev) => ({
      token: (prev?.token ?? 0) + 1,
      seconds,
    }));
    setTab("transcript");
  }

  function onPlaybackTime(seconds: number) {
    setActiveStartTime((prev) => {
      if (prev != null && Math.floor(prev) === Math.floor(seconds)) return prev;
      return seconds;
    });
  }

  async function onShare() {
    const text = [
      meeting.title,
      meeting.meeting_analysis?.summary ?? "",
      "",
      "Action items:",
      ...meeting.meeting_action_items.map(
        (a) =>
          `- ${a.task}${a.assignee ? ` (${a.assignee})` : ""}${
            a.due_date ? ` — ${a.due_date}` : ""
          }`
      ),
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Summary copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="-mx-4 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d12] text-white shadow-2xl sm:-mx-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {meeting.title}
          </h1>
          <p className="text-sm text-white/55">
            {when}
            <span className="mx-2 text-white/25">·</span>
            {duration}
            <span className="mx-2 text-white/25">·</span>
            {people}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
            Share
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onShare}
            aria-label="Copy link content"
          >
            <Link2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <div className="min-w-0 border-white/10 lg:border-r">
          <Tabs value={tab} onValueChange={setTab} className="gap-0">
            <div className="border-b border-white/10 px-5 sm:px-7">
              <TabsList
                variant="line"
                className="h-11 w-full justify-start gap-1 rounded-none bg-transparent p-0"
              >
                <TabsTrigger
                  value="summary"
                  className="rounded-none px-4 text-white/55 data-active:text-white after:bg-[#3b82f6]"
                >
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="actions"
                  className="rounded-none px-4 text-white/55 data-active:text-white after:bg-[#3b82f6]"
                >
                  Action Items ({actionCount})
                </TabsTrigger>
                <TabsTrigger
                  value="highlights"
                  className="rounded-none px-4 text-white/55 data-active:text-white after:bg-[#3b82f6]"
                >
                  Highlights ({highlightCount})
                </TabsTrigger>
                <TabsTrigger
                  value="transcript"
                  className="rounded-none px-4 text-white/55 data-active:text-white after:bg-[#3b82f6]"
                >
                  Transcript
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="summary" className="space-y-8 px-5 py-6 outline-none sm:px-7">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white/90">
                    Meeting Purpose
                  </h2>
                  <button
                    type="button"
                    className="text-white/40 hover:text-white/70"
                    onClick={onShare}
                    aria-label="Copy summary"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                <SummaryTemplateSwitcher
                  meetingId={meeting.id}
                  currentTemplateId={meeting.meeting_analysis?.template_id}
                />
                <p className="text-[15px] leading-relaxed text-white/80">
                  {meeting.meeting_analysis?.summary ??
                    "No summary available for this meeting."}
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-white/90">
                  Key Takeaways
                </h2>
                {meeting.meeting_key_points.length === 0 ? (
                  <p className="text-sm text-white/45">No key points extracted.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {meeting.meeting_key_points.map((point) => (
                      <li
                        key={point.id}
                        className="flex gap-3 text-[15px] leading-relaxed text-white/80"
                      >
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#3b82f6]" />
                        <div className="space-y-1">
                          <p>{point.content}</p>
                          {point.timestamp_seconds != null ? (
                            <button
                              type="button"
                              onClick={() =>
                                jumpToTranscript(Number(point.timestamp_seconds))
                              }
                              className="font-mono text-xs font-medium text-sky-300 hover:underline"
                            >
                              {formatTimestamp(Number(point.timestamp_seconds))}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <HighlightsPanel
                meetingId={meeting.id}
                highlights={meeting.meeting_highlights ?? []}
                onJumpToTimestamp={jumpToTranscript}
              />

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-white/90">Decisions</h2>
                {meeting.meeting_decisions.length === 0 ? (
                  <p className="text-sm text-white/45">No decisions recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {meeting.meeting_decisions.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-[15px] text-white/80"
                      >
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                        <div className="space-y-1">
                          <p>{d.decision}</p>
                          {d.timestamp_seconds != null ? (
                            <button
                              type="button"
                              onClick={() =>
                                jumpToTranscript(Number(d.timestamp_seconds))
                              }
                              className="font-mono text-xs font-medium text-sky-300 hover:underline"
                            >
                              {formatTimestamp(Number(d.timestamp_seconds))}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-white/90">
                  Action Items
                </h2>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 [&_li]:border-white/10 [&_li]:bg-transparent [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/50 [&_.text-primary]:text-sky-300">
                  <ActionItemsList
                    meetingId={meeting.id}
                    items={meeting.meeting_action_items}
                    onJumpToTimestamp={jumpToTranscript}
                  />
                </div>
              </section>

              <div className="[&_div]:border-white/10 [&_div]:bg-white/[0.03] [&_h2]:text-white [&_p]:text-white/60 [&_pre]:bg-black/30 [&_pre]:text-white/80">
                <FollowUpEmail meetingId={meeting.id} />
              </div>
            </TabsContent>

            <TabsContent value="actions" className="px-5 py-6 outline-none sm:px-7">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 [&_li]:border-white/10 [&_li]:bg-transparent [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/50 [&_.text-primary]:text-sky-300">
                <ActionItemsList
                  meetingId={meeting.id}
                  items={meeting.meeting_action_items}
                  onJumpToTimestamp={jumpToTranscript}
                />
              </div>
            </TabsContent>

            <TabsContent value="highlights" className="px-5 py-6 outline-none sm:px-7">
              <HighlightsPanel
                meetingId={meeting.id}
                highlights={meeting.meeting_highlights ?? []}
                onJumpToTimestamp={jumpToTranscript}
              />
            </TabsContent>

            <TabsContent value="transcript" className="px-5 py-6 outline-none sm:px-7">
              <div className="[&_.bg-card]:bg-[#12151c] [&_.border-border\/70]:border-white/10 [&_.text-foreground\/90]:text-white/85 [&_.text-primary]:text-sky-300 [&_.hover\:bg-muted\/40:hover]:bg-white/5 [&_.bg-accent\/80]:bg-sky-500/15">
                <TranscriptPanel
                  meetingId={meeting.id}
                  segments={meeting.transcript_segments}
                  highlights={meeting.meeting_highlights ?? []}
                  playbackTime={activeStartTime}
                  onSelectTimestamp={jumpToTranscript}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="flex flex-col gap-4 bg-[#0e1118] p-4 sm:p-5">
          <MeetingRecordingPlayer
            meetingId={meeting.id}
            source={meeting.source}
            recordingDriveFileId={meeting.recording_drive_file_id}
            recordingExportUri={meeting.recording_export_uri}
            recordingState={meeting.recording_state}
            durationLabel={duration}
            seekRequest={seekRequest}
            onTimeUpdate={onPlaybackTime}
          />

          <AskMeeting
            meetingId={meeting.id}
            onJumpToTimestamp={jumpToTranscript}
            className="min-h-[360px] flex-1"
          />
        </aside>
      </div>
    </div>
  );
}
