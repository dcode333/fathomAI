"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { createFollowUpEmail } from "@/lib/meetings/ai-actions";
import { Button } from "@/components/ui/button";

type FollowUpEmailProps = {
  meetingId: string;
};

export function FollowUpEmail({ meetingId }: FollowUpEmailProps) {
  const [email, setEmail] = useState<{ subject: string; body: string; provider: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    startTransition(async () => {
      const result = await createFollowUpEmail(meetingId);
      if (result.error || !result.result) {
        toast.error(result.error ?? "Could not generate email");
        return;
      }
      setEmail({
        subject: result.result.subject,
        body: result.result.body,
        provider: result.provider ?? "local",
      });
      toast.success("Follow-up email generated");
    });
  }

  async function onCopy() {
    if (!email) return;
    const text = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4 text-primary" />
          Follow-up email
        </div>
        <Button size="sm" onClick={onGenerate} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Generate
        </Button>
      </div>

      {email ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Subject</p>
            <p className="mt-1 text-sm font-medium">{email.subject}</p>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-3 font-sans text-sm leading-relaxed">
            {email.body}
          </pre>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              via {email.provider === "openai" ? "OpenAI" : "local analyzer"}
            </p>
            <Button size="sm" variant="outline" onClick={onCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy Email"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Generate a draft email from this meeting&apos;s summary, decisions, and
          action items.
        </p>
      )}
    </div>
  );
}
