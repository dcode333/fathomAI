"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { retryMeetingAnalysis } from "@/lib/meetings/ai-actions";
import {
  SUMMARY_TEMPLATES,
  type SummaryTemplateId,
} from "@/lib/ai/templates";
import { cn } from "@/lib/utils";

type SummaryTemplateSwitcherProps = {
  meetingId: string;
  currentTemplateId?: string | null;
  className?: string;
};

export function SummaryTemplateSwitcher({
  meetingId,
  currentTemplateId = "general",
  className,
}: SummaryTemplateSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(
    (currentTemplateId as SummaryTemplateId) || "general"
  );

  function onChange(next: SummaryTemplateId) {
    if (next === selected || pending) return;
    const previous = selected;
    setSelected(next);
    startTransition(async () => {
      const result = await retryMeetingAnalysis(meetingId, next);
      if (result.error) {
        setSelected(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Summary rebuilt as ${SUMMARY_TEMPLATES.find((t) => t.id === next)?.label}`);
      router.refresh();
    });
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-white/45 uppercase">
          Summary template
        </p>
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-sky-300">
            <Loader2 className="size-3 animate-spin" />
            Rebuilding…
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-white/35">
            <Sparkles className="size-3" />
            Switch & re-analyze
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SUMMARY_TEMPLATES.map((template) => {
          const active = selected === template.id;
          return (
            <button
              key={template.id}
              type="button"
              disabled={pending}
              title={template.description}
              onClick={() => onChange(template.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                active
                  ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/85",
                pending && "opacity-60"
              )}
            >
              {template.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
