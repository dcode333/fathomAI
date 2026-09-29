/**
 * Canonical Demo Meeting scenario.
 * Used by seed (Phase 2/3) and later by the Demo Meeting pipeline (Phase 4).
 */

export type DemoSegment = {
  speaker: string;
  text: string;
  start_time: number;
  end_time: number;
  sequence: number;
};

export type DemoScenario = {
  title: string;
  duration_seconds: number;
  participants: { name: string; role: string }[];
  summary: string;
  key_points: { content: string; timestamp_seconds: number }[];
  decisions: { decision: string; timestamp_seconds: number }[];
  action_items: {
    task: string;
    assignee: string;
    due_date: string;
    timestamp_seconds: number;
  }[];
  transcript: DemoSegment[];
};

export const WEBSITE_REDESIGN_DEMO: DemoScenario = {
  title: "Website Redesign — Client Discussion",
  duration_seconds: 28 * 60,
  participants: [
    { name: "Umair", role: "Host" },
    { name: "Sarah", role: "Client" },
    { name: "John", role: "Product Manager" },
  ],
  summary:
    "The team discussed the dashboard launch and prioritized payment integration. They agreed on an October 15 target, with Stripe as the first deliverable and reporting deferred until after launch.",
  key_points: [
    {
      content: "Dashboard target launch date is October 15.",
      timestamp_seconds: 124,
    },
    {
      content: "Stripe payment integration is the highest priority for launch.",
      timestamp_seconds: 198,
    },
    {
      content: "Reporting features can follow after the initial launch.",
      timestamp_seconds: 215,
    },
    {
      content: "Sarah will provide Stripe credentials the same day.",
      timestamp_seconds: 280,
    },
  ],
  decisions: [
    {
      decision: "Prioritize Stripe integration over reporting for launch.",
      timestamp_seconds: 198,
    },
    {
      decision: "Target October 15 for the new dashboard release.",
      timestamp_seconds: 124,
    },
  ],
  action_items: [
    {
      task: "Implement first version of payment integration",
      assignee: "Umair",
      due_date: "Next week",
      timestamp_seconds: 245,
    },
    {
      task: "Send Stripe credentials",
      assignee: "Sarah",
      due_date: "Today",
      timestamp_seconds: 280,
    },
  ],
  transcript: [
    {
      speaker: "Umair",
      text: "Thanks for joining, Sarah. John and I wanted to align on the redesign timeline and what has to ship first.",
      start_time: 32,
      end_time: 48,
      sequence: 0,
    },
    {
      speaker: "Sarah",
      text: "Absolutely. We'd like to have the new dashboard ready by October 15th. That's our hard date for the client rollout.",
      start_time: 52,
      end_time: 68,
      sequence: 1,
    },
    {
      speaker: "John",
      text: "October 15 is tight but doable if we cut scope carefully. What matters most on day one?",
      start_time: 72,
      end_time: 88,
      sequence: 2,
    },
    {
      speaker: "Sarah",
      text: "Payments. If customers can't check out cleanly, the rest of the dashboard doesn't matter.",
      start_time: 94,
      end_time: 108,
      sequence: 3,
    },
    {
      speaker: "Umair",
      text: "That works. I'll prioritize the payment integration first. Reporting can wait.",
      start_time: 124,
      end_time: 138,
      sequence: 4,
    },
    {
      speaker: "John",
      text: "Stripe is the most important part for launch. Reporting can come later — maybe phase two.",
      start_time: 198,
      end_time: 218,
      sequence: 5,
    },
    {
      speaker: "Sarah",
      text: "Agreed. I'm fine delaying charts if checkout is solid.",
      start_time: 222,
      end_time: 232,
      sequence: 6,
    },
    {
      speaker: "Umair",
      text: "I'll have the first version ready next week. Once Stripe is wired, we can tighten the UI.",
      start_time: 245,
      end_time: 262,
      sequence: 7,
    },
    {
      speaker: "Sarah",
      text: "Perfect. I'll send the Stripe credentials today so you're not blocked.",
      start_time: 280,
      end_time: 294,
      sequence: 8,
    },
    {
      speaker: "John",
      text: "One open question — do we need a staging review with your team before October 15?",
      start_time: 310,
      end_time: 324,
      sequence: 9,
    },
    {
      speaker: "Sarah",
      text: "Yes. Let's schedule a walkthrough the week before launch.",
      start_time: 330,
      end_time: 342,
      sequence: 10,
    },
    {
      speaker: "Umair",
      text: "Great. I'll send a calendar invite after this call. Thanks everyone.",
      start_time: 350,
      end_time: 362,
      sequence: 11,
    },
  ],
};

export const WEEKLY_SYNC_DEMO: DemoScenario = {
  title: "Weekly Product Sync",
  duration_seconds: 32 * 60,
  participants: [
    { name: "Umair", role: "Host" },
    { name: "Maya", role: "Design" },
    { name: "Alex", role: "Engineering" },
  ],
  summary:
    "Reviewed sprint progress and agreed to ship the onboarding flow this week, deferring analytics polish to the next sprint.",
  key_points: [
    {
      content: "Onboarding flow is the sprint priority.",
      timestamp_seconds: 90,
    },
    {
      content: "Analytics polish is deferred to next sprint.",
      timestamp_seconds: 180,
    },
    {
      content: "Empty-state illustrations needed by Thursday.",
      timestamp_seconds: 210,
    },
  ],
  decisions: [
    {
      decision: "Ship onboarding this week.",
      timestamp_seconds: 90,
    },
    {
      decision: "Defer analytics polish to next sprint.",
      timestamp_seconds: 180,
    },
  ],
  action_items: [
    {
      task: "Ship onboarding flow to staging",
      assignee: "Alex",
      due_date: "Friday",
      timestamp_seconds: 140,
    },
    {
      task: "Finalize empty-state illustrations",
      assignee: "Maya",
      due_date: "Thursday",
      timestamp_seconds: 210,
    },
    {
      task: "Write release notes draft",
      assignee: "Umair",
      due_date: "Friday",
      timestamp_seconds: 250,
    },
  ],
  transcript: [
    {
      speaker: "Umair",
      text: "Quick sync — where are we on onboarding versus analytics?",
      start_time: 20,
      end_time: 32,
      sequence: 0,
    },
    {
      speaker: "Alex",
      text: "Onboarding is almost ready for staging. Analytics charts still need polish.",
      start_time: 40,
      end_time: 55,
      sequence: 1,
    },
    {
      speaker: "Maya",
      text: "I can finish the empty states by Thursday if we lock the copy today.",
      start_time: 70,
      end_time: 85,
      sequence: 2,
    },
    {
      speaker: "Umair",
      text: "Let's ship onboarding this week. Analytics can wait until next sprint.",
      start_time: 90,
      end_time: 105,
      sequence: 3,
    },
    {
      speaker: "Alex",
      text: "Works for me. I'll push onboarding to staging by Friday.",
      start_time: 140,
      end_time: 152,
      sequence: 4,
    },
    {
      speaker: "Umair",
      text: "Perfect. Maya owns illustrations; I'll draft release notes Friday morning.",
      start_time: 210,
      end_time: 230,
      sequence: 5,
    },
  ],
};

export function scenarioForTitle(title: string): DemoScenario | null {
  if (title.includes("Website Redesign")) return WEBSITE_REDESIGN_DEMO;
  if (title.includes("Weekly Product Sync")) return WEEKLY_SYNC_DEMO;
  return null;
}
