export type MeetingSource = "google_meet" | "demo" | "upload";

export type MeetingStatus =
  | "scheduled"
  | "joining"
  | "recording"
  | "processing"
  | "completed"
  | "failed";

export type ActionItemStatus = "pending" | "completed";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Meeting = {
  id: string;
  user_id: string;
  title: string;
  meeting_url: string | null;
  source: MeetingSource;
  status: MeetingStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_drive_file_id: string | null;
  recording_export_uri: string | null;
  recording_state: string | null;
  conference_record_name: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingParticipant = {
  id: string;
  meeting_id: string;
  name: string;
  email: string | null;
  role: string | null;
  created_at: string;
};

export type TranscriptSegment = {
  id: string;
  meeting_id: string;
  speaker: string;
  text: string;
  start_time: number;
  end_time: number | null;
  sequence: number;
  created_at: string;
};

export type MeetingAnalysis = {
  id: string;
  meeting_id: string;
  summary: string;
  template_id: string;
  created_at: string;
  updated_at: string;
};

export type MeetingKeyPoint = {
  id: string;
  meeting_id: string;
  content: string;
  timestamp_seconds: number | null;
  created_at: string;
};

export type MeetingDecision = {
  id: string;
  meeting_id: string;
  decision: string;
  timestamp_seconds: number | null;
  created_at: string;
};

export type MeetingActionItem = {
  id: string;
  meeting_id: string;
  task: string;
  assignee: string | null;
  due_date: string | null;
  status: ActionItemStatus;
  timestamp_seconds: number | null;
  created_at: string;
  updated_at: string;
};

export type MeetingHighlight = {
  id: string;
  meeting_id: string;
  user_id: string;
  timestamp_seconds: number;
  speaker: string | null;
  quote: string;
  note: string | null;
  source: string;
  created_at: string;
};

export type MeetingClip = {
  id: string;
  meeting_id: string;
  highlight_id: string | null;
  created_by: string;
  share_token: string;
  title: string | null;
  quote: string;
  speaker: string | null;
  start_seconds: number;
  end_seconds: number | null;
  note: string | null;
  meeting_title: string | null;
  created_at: string;
};

export type AiLog = {
  id: string;
  user_id: string | null;
  meeting_id: string | null;
  model: string;
  operation: string;
  started_at: string;
  completed_at: string | null;
  latency_ms: number | null;
  success: boolean;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

export type GoogleIntegration = {
  id: string;
  user_id: string;
  google_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  created_at: string;
  updated_at: string;
};

export type MeetingWithRelations = Meeting & {
  meeting_participants: MeetingParticipant[];
  meeting_analysis: MeetingAnalysis | null;
  meeting_key_points: MeetingKeyPoint[];
  meeting_decisions: MeetingDecision[];
  meeting_action_items: MeetingActionItem[];
  transcript_segments: TranscriptSegment[];
};

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meetings: {
        Row: Meeting;
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          meeting_url?: string | null;
          source?: MeetingSource;
          status?: MeetingStatus;
          started_at?: string | null;
          ended_at?: string | null;
          duration_seconds?: number | null;
          recording_drive_file_id?: string | null;
          recording_export_uri?: string | null;
          recording_state?: string | null;
          conference_record_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          meeting_url?: string | null;
          source?: MeetingSource;
          status?: MeetingStatus;
          started_at?: string | null;
          ended_at?: string | null;
          duration_seconds?: number | null;
          recording_drive_file_id?: string | null;
          recording_export_uri?: string | null;
          recording_state?: string | null;
          conference_record_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_participants: {
        Row: MeetingParticipant;
        Insert: {
          id?: string;
          meeting_id: string;
          name: string;
          email?: string | null;
          role?: string | null;
          created_at?: string;
        };
        Update: Partial<MeetingParticipant>;
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      transcript_segments: {
        Row: TranscriptSegment;
        Insert: {
          id?: string;
          meeting_id: string;
          speaker: string;
          text: string;
          start_time?: number;
          end_time?: number | null;
          sequence?: number;
          created_at?: string;
        };
        Update: Partial<TranscriptSegment>;
        Relationships: [
          {
            foreignKeyName: "transcript_segments_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_analysis: {
        Row: MeetingAnalysis;
        Insert: {
          id?: string;
          meeting_id: string;
          summary: string;
          template_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MeetingAnalysis>;
        Relationships: [
          {
            foreignKeyName: "meeting_analysis_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: true;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_key_points: {
        Row: MeetingKeyPoint;
        Insert: {
          id?: string;
          meeting_id: string;
          content: string;
          timestamp_seconds?: number | null;
          created_at?: string;
        };
        Update: Partial<MeetingKeyPoint>;
        Relationships: [
          {
            foreignKeyName: "meeting_key_points_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_decisions: {
        Row: MeetingDecision;
        Insert: {
          id?: string;
          meeting_id: string;
          decision: string;
          timestamp_seconds?: number | null;
          created_at?: string;
        };
        Update: Partial<MeetingDecision>;
        Relationships: [
          {
            foreignKeyName: "meeting_decisions_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_action_items: {
        Row: MeetingActionItem;
        Insert: {
          id?: string;
          meeting_id: string;
          task: string;
          assignee?: string | null;
          due_date?: string | null;
          status?: ActionItemStatus;
          timestamp_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MeetingActionItem>;
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_highlights: {
        Row: MeetingHighlight;
        Insert: {
          id?: string;
          meeting_id: string;
          user_id: string;
          timestamp_seconds?: number;
          speaker?: string | null;
          quote: string;
          note?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: Partial<MeetingHighlight>;
        Relationships: [
          {
            foreignKeyName: "meeting_highlights_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      meeting_clips: {
        Row: MeetingClip;
        Insert: {
          id?: string;
          meeting_id: string;
          highlight_id?: string | null;
          created_by: string;
          share_token?: string;
          title?: string | null;
          quote: string;
          speaker?: string | null;
          start_seconds?: number;
          end_seconds?: number | null;
          note?: string | null;
          meeting_title?: string | null;
          created_at?: string;
        };
        Update: Partial<MeetingClip>;
        Relationships: [
          {
            foreignKeyName: "meeting_clips_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          }
        ];
      };
      ai_logs: {
        Row: AiLog;
        Insert: {
          id?: string;
          user_id?: string | null;
          meeting_id?: string | null;
          model: string;
          operation: string;
          started_at?: string;
          completed_at?: string | null;
          latency_ms?: number | null;
          success?: boolean;
          error?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          created_at?: string;
        };
        Update: Partial<AiLog>;
        Relationships: [];
      };
      google_integrations: {
        Row: GoogleIntegration;
        Insert: {
          id?: string;
          user_id: string;
          google_email?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          scopes?: string[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<GoogleIntegration>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      owns_meeting: {
        Args: { p_meeting_id: string };
        Returns: boolean;
      };
      search_user_meeting_ids: {
        Args: { search_query: string };
        Returns: {
          meeting_id: string;
          match_snippet: string;
          match_source: string;
        }[];
      };
      get_public_clip: {
        Args: { p_token: string };
        Returns: {
          id: string;
          title: string | null;
          quote: string;
          speaker: string | null;
          start_seconds: number;
          end_seconds: number | null;
          note: string | null;
          meeting_title: string | null;
          created_at: string;
        }[];
      };
    };
    Enums: {
      meeting_source: MeetingSource;
      meeting_status: MeetingStatus;
      action_item_status: ActionItemStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type { Json };
