import { getSummaryTemplate, type SummaryTemplateId } from "@/lib/ai/templates";

export const MEETING_ANALYSIS_SYSTEM = `You are an AI meeting intelligence assistant.

Analyze the meeting transcript carefully.

Extract:
1. A concise executive summary (2-4 sentences) shaped by the requested template
2. Important discussion points
3. Decisions that were explicitly made
4. Action items with assignees and deadlines when mentioned
5. Timestamps in seconds from the transcript when possible

Rules:
- Do not invent information.
- Only extract information supported by the transcript.
- If a field is unknown, use null.
- Return ONLY valid JSON matching the required schema.`;

export function buildMeetingAnalysisUserPrompt(
  transcript: string,
  templateId: SummaryTemplateId = "general"
): string {
  const template = getSummaryTemplate(templateId);
  return `Summary template: ${template.label}
Template emphasis: ${template.emphasis}

Analyze this meeting transcript and return structured JSON with keys:
summary (string),
key_points (array of { text, timestamp }),
decisions (array of { text, timestamp }),
action_items (array of { task, assignee, due_date, timestamp }).

Transcript:
---
${transcript}
---`;
}

export function buildChunkAnalysisUserPrompt(
  transcript: string,
  chunkIndex: number,
  chunkCount: number,
  templateId: SummaryTemplateId = "general"
): string {
  const template = getSummaryTemplate(templateId);
  return `This is chunk ${chunkIndex + 1} of ${chunkCount} from a long meeting.
Summary template: ${template.label}
Template emphasis: ${template.emphasis}

Extract partial structured JSON for THIS chunk only with keys:
summary (string — 1-2 sentences for this chunk),
key_points (array of { text, timestamp }),
decisions (array of { text, timestamp }),
action_items (array of { task, assignee, due_date, timestamp }).

Do not invent information outside this chunk.

Chunk transcript:
---
${transcript}
---`;
}

export function buildMergedSummaryUserPrompt(
  chunkSummaries: string[],
  templateId: SummaryTemplateId = "general"
): string {
  const template = getSummaryTemplate(templateId);
  return `Summary template: ${template.label}
Template emphasis: ${template.emphasis}

You previously analyzed a long meeting in ${chunkSummaries.length} chunks.
Write ONE final meeting summary (2-4 sentences) that synthesizes these chunk summaries.
Return ONLY JSON: { "summary": string }

Chunk summaries:
${chunkSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

export const MEETING_QA_SYSTEM = `You answer questions about a single meeting using only its transcript.

Rules:
- Use only the transcript. If the answer is not present, say you cannot find it in the meeting.
- Include a timestamp (seconds) for the most relevant moment when possible.
- Include a short supporting quote when possible.
- Return ONLY valid JSON: { "answer": string, "timestamp": number|null, "quote": string|null }`;

export function buildMeetingQaUserPrompt(
  transcript: string,
  question: string
): string {
  return `Question: ${question}

Transcript:
---
${transcript}
---`;
}

export const FOLLOW_UP_EMAIL_SYSTEM = `You write concise professional follow-up emails after meetings.

Rules:
- Base the email only on the provided meeting summary, decisions, and action items.
- Include subject and body.
- Use a warm, clear tone.
- List next steps as bullets when action items exist.
- Return ONLY valid JSON: { "subject": string, "body": string }`;

export function buildFollowUpEmailUserPrompt(input: {
  title: string;
  summary: string;
  decisions: string[];
  actionItems: { task: string; assignee: string | null; due_date: string | null }[];
  senderName: string;
  recipientHint?: string | null;
}): string {
  return `Meeting title: ${input.title}
Sender name: ${input.senderName}
Primary recipient hint: ${input.recipientHint ?? "the other participants"}

Summary:
${input.summary}

Decisions:
${input.decisions.map((d) => `- ${d}`).join("\n") || "- (none)"}

Action items:
${
  input.actionItems
    .map(
      (a) =>
        `- ${a.task}${a.assignee ? ` (${a.assignee})` : ""}${
          a.due_date ? ` — due ${a.due_date}` : ""
        }`
    )
    .join("\n") || "- (none)"
}`;
}
