export type SummaryTemplateId =
  | "general"
  | "executive"
  | "action_focused"
  | "sales"
  | "technical";

export type SummaryTemplate = {
  id: SummaryTemplateId;
  label: string;
  description: string;
  emphasis: string;
};

export const SUMMARY_TEMPLATES: SummaryTemplate[] = [
  {
    id: "general",
    label: "General",
    description: "Balanced summary for most meetings",
    emphasis:
      "Write a clear, balanced summary covering purpose, discussion, decisions, and next steps.",
  },
  {
    id: "executive",
    label: "Executive",
    description: "Short briefing for leadership",
    emphasis:
      "Write a crisp executive briefing: outcomes first, then only the decisions and risks that matter to leadership. Keep the summary to 2–3 dense sentences.",
  },
  {
    id: "action_focused",
    label: "Action-focused",
    description: "Owners, deadlines, and next steps",
    emphasis:
      "Prioritize concrete action items with owners and deadlines. The summary should foreground what must happen next and who owns it.",
  },
  {
    id: "sales",
    label: "Sales / client",
    description: "Stakeholder needs and commitments",
    emphasis:
      "Frame for a sales or client call: customer needs, objections, commitments made, and follow-ups that advance the deal or relationship.",
  },
  {
    id: "technical",
    label: "Technical",
    description: "Architecture, tradeoffs, and work",
    emphasis:
      "Frame for an engineering discussion: technical decisions, tradeoffs, blockers, and implementation follow-ups. Prefer precise language over fluff.",
  },
];

export const DEFAULT_TEMPLATE_ID: SummaryTemplateId = "general";

export function getSummaryTemplate(
  id: string | null | undefined
): SummaryTemplate {
  return (
    SUMMARY_TEMPLATES.find((t) => t.id === id) ??
    SUMMARY_TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!
  );
}

export function isSummaryTemplateId(value: string): value is SummaryTemplateId {
  return SUMMARY_TEMPLATES.some((t) => t.id === value);
}
