import { z } from "zod";

export const meetingAnalysisSchema = z.object({
  summary: z.string().min(1),
  key_points: z.array(
    z.object({
      text: z.string().min(1),
      timestamp: z.number().nonnegative().nullable(),
    })
  ),
  decisions: z.array(
    z.object({
      text: z.string().min(1),
      timestamp: z.number().nonnegative().nullable(),
    })
  ),
  action_items: z.array(
    z.object({
      task: z.string().min(1),
      assignee: z.string().nullable(),
      due_date: z.string().nullable(),
      timestamp: z.number().nonnegative().nullable(),
    })
  ),
});

export type MeetingAnalysisResult = z.infer<typeof meetingAnalysisSchema>;

export const meetingAnswerSchema = z.object({
  answer: z.string().min(1),
  timestamp: z.number().nonnegative().nullable(),
  quote: z.string().nullable(),
});

export type MeetingAnswerResult = z.infer<typeof meetingAnswerSchema>;

export const followUpEmailSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type FollowUpEmailResult = z.infer<typeof followUpEmailSchema>;
