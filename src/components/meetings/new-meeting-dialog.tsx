"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarPlus, Loader2, Plus, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import { createMeetWithNotetaker } from "@/lib/google/actions";
import {
  createGoogleMeetMeeting,
  startDemoMeeting,
} from "@/lib/meetings/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type NewMeetingDialogProps = {
  triggerClassName?: string;
  googleConnected?: boolean;
};

export function NewMeetingDialog({
  triggerClassName,
  googleConnected = false,
}: NewMeetingDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [meetUrl, setMeetUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "meet" | "create" | "demo">(
    "idle"
  );

  function runMeet() {
    setMode("meet");
    startTransition(async () => {
      const result = await createGoogleMeetMeeting(meetUrl);
      if (result.error || !result.meetingId) {
        toast.error(result.error ?? "Could not start notetaker");
        setMode("idle");
        return;
      }
      toast.success("Meeting linked — paste transcript after the call");
      setOpen(false);
      setMeetUrl("");
      setMode("idle");
      router.push(`/meetings/${result.meetingId}`);
      router.refresh();
    });
  }

  function runCreateMeet() {
    setMode("create");
    startTransition(async () => {
      const result = await createMeetWithNotetaker("Fathom AI Meeting");
      if (result.error || !result.meetingId) {
        toast.error(result.error ?? "Could not create Google Meet");
        setMode("idle");
        return;
      }
      toast.success("Google Meet created");
      setOpen(false);
      setMode("idle");
      if (result.meetUrl) {
        window.open(result.meetUrl, "_blank", "noopener,noreferrer");
      }
      router.push(`/meetings/${result.meetingId}`);
      router.refresh();
    });
  }

  function runDemo() {
    setMode("demo");
    startTransition(async () => {
      const result = await startDemoMeeting();
      if (result.error || !result.meetingId) {
        toast.error(result.error ?? "Could not start demo meeting");
        setMode("idle");
        return;
      }
      toast.success("Demo meeting started");
      setOpen(false);
      setMode("idle");
      router.push(`/meetings/${result.meetingId}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="lg" className={triggerClassName} />}
      >
        <Plus className="size-4" />
        New Meeting
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a meeting</DialogTitle>
          <DialogDescription>
            Create or link a Google Meet, or run Demo Meeting for a full
            simulated call.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {googleConnected ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={runCreateMeet}
              disabled={pending}
            >
              {pending && mode === "create" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarPlus className="size-4" />
              )}
              Create Google Meet
            </Button>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Connect Google in Settings to auto-create Meet links. You can
              still paste an existing Meet URL below.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="meet-url" className="flex items-center gap-2">
              <Video className="size-3.5 text-primary" />
              Google Meet URL
            </Label>
            <Input
              id="meet-url"
              placeholder="https://meet.google.com/…"
              value={meetUrl}
              onChange={(e) => setMeetUrl(e.target.value)}
              disabled={pending}
            />
            <Button
              className="w-full"
              onClick={runMeet}
              disabled={pending || !meetUrl.trim()}
            >
              {pending && mode === "meet" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Link Meet & continue
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <button
            type="button"
            onClick={runDemo}
            disabled={pending}
            className="flex w-full items-start gap-3 rounded-xl border border-border/80 bg-accent/40 p-4 text-left transition-colors hover:bg-accent/70 disabled:opacity-60"
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {pending && mode === "demo" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-medium">Use Demo Meeting</span>
              <span className="block text-sm text-muted-foreground">
                Watch a live scripted call, end it, and get real AI notes from
                the transcript.
              </span>
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
