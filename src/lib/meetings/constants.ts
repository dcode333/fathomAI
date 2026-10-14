/**
 * Shared architecture notes for the RekApp demo.
 *
 * Meeting sources (google_meet | demo | upload) converge on one pipeline:
 *   Meeting → Transcript segments → AI structured analysis → Meeting Intelligence UI
 *
 * Do not fork demo into a separate fake app — same tables, same pages.
 */

export const APP_NAME = "RekApp";

export const MEETING_STATUSES = [
  "scheduled",
  "joining",
  "recording",
  "processing",
  "completed",
  "failed",
] as const;

export const MEETING_SOURCES = ["google_meet", "demo", "upload"] as const;
