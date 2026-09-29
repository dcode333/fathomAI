"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { askMeetingAi } from "@/lib/meetings/ai-actions";
import { formatTimestamp } from "@/lib/meetings/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AskMeetingProps = {
  meetingId: string;
  onJumpToTimestamp?: (seconds: number) => void;
  className?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number | null;
  quote?: string | null;
};

export function AskMeeting({
  meetingId,
  onJumpToTimestamp,
  className,
}: AskMeetingProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, startTransition] = useTransition();

  function onAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    startTransition(async () => {
      const result = await askMeetingAi(meetingId, q);
      if (result.error || !result.result) {
        toast.error(result.error ?? "Could not answer");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I couldn't find that in this meeting.",
          },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.result!.answer,
          timestamp: result.result!.timestamp,
          quote: result.result!.quote,
        },
      ]);
    });
  }

  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#12151c]",
        className
      )}
    >
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-white/55 uppercase">
          Ask AI
        </p>
        <p className="mt-0.5 text-sm text-white/75">This call</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-white/45">
            Ask anything about this meeting — deadlines, decisions, who owns
            what…
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "ml-6 bg-[#2b6cb0] text-white"
                  : "mr-2 bg-white/5 text-white/90"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.quote ? (
                <p className="mt-2 border-l-2 border-sky-400/50 pl-2 text-xs text-white/55 italic">
                  “{msg.quote}”
                </p>
              ) : null}
              {msg.timestamp != null ? (
                <button
                  type="button"
                  className="mt-2 font-mono text-xs font-medium text-sky-300 hover:underline"
                  onClick={() => onJumpToTimestamp?.(Number(msg.timestamp))}
                >
                  Jump to {formatTimestamp(Number(msg.timestamp))}
                </button>
              ) : null}
            </div>
          ))
        )}
        {pending ? (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Loader2 className="size-3.5 animate-spin" />
            Thinking…
          </div>
        ) : null}
      </div>

      <form
        onSubmit={onAsk}
        className="flex items-center gap-2 border-t border-white/10 p-3"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything…"
          disabled={pending}
          className="h-10 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-sky-400/40"
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || !question.trim()}
          className="size-10 shrink-0 rounded-xl bg-[#2b6cb0] text-white hover:bg-[#2b6cb0]/90"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
