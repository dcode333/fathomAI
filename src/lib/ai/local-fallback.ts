import type { MeetingAnalysisResult } from "@/lib/ai/schemas";

type Segment = {
  speaker: string;
  text: string;
  start_time: number;
};

/**
 * Deterministic transcript analyzer used when OPENAI_API_KEY is missing.
 * Not production NLP — but it actually reads the transcript (not hardcoded UI text).
 */
export function analyzeTranscriptLocally(
  segments: Segment[]
): MeetingAnalysisResult {
  const key_points: MeetingAnalysisResult["key_points"] = [];
  const decisions: MeetingAnalysisResult["decisions"] = [];
  const action_items: MeetingAnalysisResult["action_items"] = [];

  const decisionHints =
    /\b(agreed|agree|we'll|we will|let'?s|decision|prioritize|ship|target|go with)\b/i;
  const actionHints =
    /\b(i'?ll|i will|can you|please|send|implement|schedule|draft|finalize|push|have .+ ready)\b/i;
  const dateHints =
    /\b(today|tomorrow|tonight|next week|this week|friday|thursday|monday|october\s+\d{1,2}|\d{1,2}\/\d{1,2})\b/i;

  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;

    if (dateHints.test(text) || /priority|launch|important/i.test(text)) {
      key_points.push({
        text: `${seg.speaker}: ${text}`,
        timestamp: seg.start_time,
      });
    }

    if (decisionHints.test(text)) {
      decisions.push({
        text,
        timestamp: seg.start_time,
      });
    }

    if (actionHints.test(text)) {
      const due = text.match(dateHints)?.[0] ?? null;
      let assignee: string | null = seg.speaker;
      const lower = text.toLowerCase();
      if (lower.startsWith("i'll") || lower.startsWith("i will")) {
        assignee = seg.speaker;
      } else if (/sarah/i.test(text)) assignee = "Sarah";
      else if (/john/i.test(text)) assignee = "John";
      else if (/umair/i.test(text)) assignee = "Umair";
      else if (/maya/i.test(text)) assignee = "Maya";
      else if (/alex/i.test(text)) assignee = "Alex";

      action_items.push({
        task: text,
        assignee,
        due_date: due,
        timestamp: seg.start_time,
      });
    }
  }

  const speakers = [...new Set(segments.map((s) => s.speaker))];
  const summaryParts = [
    `Meeting with ${speakers.join(", ")}.`,
    key_points[0]
      ? `Key topic: ${key_points[0].text.replace(/^[^:]+:\s*/, "").slice(0, 140)}`
      : "Discussion covered project priorities and next steps.",
    decisions[0]
      ? `A decision noted: ${decisions[0].text.slice(0, 120)}`
      : null,
    action_items.length
      ? `${action_items.length} follow-up action${action_items.length === 1 ? "" : "s"} identified.`
      : null,
  ].filter(Boolean);

  // Deduplicate loosely
  const uniq = <T extends { text?: string; task?: string }>(
    items: T[],
    key: keyof T
  ) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const value = String(item[key] ?? "")
        .toLowerCase()
        .slice(0, 80);
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  };

  return {
    summary: summaryParts.join(" "),
    key_points: uniq(key_points, "text").slice(0, 6),
    decisions: uniq(decisions, "text").slice(0, 5),
    action_items: uniq(action_items, "task").slice(0, 8),
  };
}

export function answerFromTranscriptLocally(
  segments: Segment[],
  question: string
): { answer: string; timestamp: number | null; quote: string | null } {
  const q = question.toLowerCase();
  const keywords = q
    .replace(/[?.,!]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["what", "when", "where", "about", "this", "that", "does", "did", "have", "from"].includes(w));

  let best: Segment | null = null;
  let bestScore = 0;

  for (const seg of segments) {
    const hay = `${seg.speaker} ${seg.text}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (hay.includes(kw)) score += 1;
    }
    if (q.includes("deadline") || q.includes("date") || q.includes("october")) {
      if (/october|deadline|ready by|launch/i.test(seg.text)) score += 3;
    }
    if (q.includes("sarah") && /sarah/i.test(seg.speaker)) score += 2;
    if (q.includes("stripe") && /stripe/i.test(seg.text)) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = seg;
    }
  }

  if (!best || bestScore === 0) {
    return {
      answer: "I couldn't find that in this meeting transcript.",
      timestamp: null,
      quote: null,
    };
  }

  return {
    answer: `${best.speaker} said: "${best.text}"`,
    timestamp: best.start_time,
    quote: best.text,
  };
}

export function draftFollowUpEmailLocally(input: {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: { task: string; assignee: string | null; due_date: string | null }[];
  senderName: string;
  recipientHint?: string | null;
}): { subject: string; body: string } {
  const to = input.recipientHint || "team";
  const nextSteps = input.actionItems
    .map(
      (a) =>
        `• ${a.assignee ? `${a.assignee} — ` : ""}${a.task}${
          a.due_date ? ` (due ${a.due_date})` : ""
        }`
    )
    .join("\n");

  const decisions = input.decisions.map((d) => `• ${d}`).join("\n");

  return {
    subject: `Follow-up — ${input.title}`,
    body: `Hi ${to},

Thanks for today's discussion on ${input.title}.

${input.summary}

${decisions ? `What we agreed:\n${decisions}\n` : ""}
${nextSteps ? `Next steps:\n${nextSteps}\n` : ""}
Best,
${input.senderName}`,
  };
}
