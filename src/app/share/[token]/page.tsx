import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark, Clock3, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatTimestamp } from "@/lib/meetings/format";

export default async function PublicClipPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_public_clip", {
    p_token: token,
  });

  if (error) {
    console.error("get_public_clip", error.message);
  }

  const clip = Array.isArray(data) ? data[0] : data;
  if (!clip) {
    notFound();
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.16)_0%,_transparent_55%)]"
      />

      <div className="relative w-full max-w-xl space-y-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Fathom AI</p>
            <p className="text-xs text-muted-foreground">Shared meeting clip</p>
          </div>
        </div>

        <article className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            From {clip.meeting_title || "a meeting"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
            {clip.title || "Highlighted moment"}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-mono text-primary">
              <Clock3 className="size-3.5" />
              {formatTimestamp(Number(clip.start_seconds))}
              {clip.end_seconds != null
                ? ` – ${formatTimestamp(Number(clip.end_seconds))}`
                : ""}
            </span>
            {clip.speaker ? <span>· {clip.speaker}</span> : null}
          </div>

          <blockquote className="mt-6 rounded-2xl border border-border/60 bg-muted/40 px-4 py-4 text-[15px] leading-relaxed">
            <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Bookmark className="size-3.5 fill-current" />
              Clip
            </span>
            <p className="text-foreground">“{clip.quote}”</p>
          </blockquote>

          {clip.note ? (
            <p className="mt-4 text-sm text-muted-foreground">{clip.note}</p>
          ) : null}
        </article>

        <p className="text-center text-sm text-muted-foreground">
          Want notes like this for your meetings?{" "}
          <Link href="/auth/signup" className="font-medium text-primary hover:underline">
            Try Fathom AI
          </Link>
        </p>
      </div>
    </div>
  );
}
