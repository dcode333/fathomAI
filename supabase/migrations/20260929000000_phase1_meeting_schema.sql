-- Fathom AI Demo — Phase 1 schema
-- Pipeline: Meeting → Transcript → AI Analysis

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.meeting_source AS ENUM ('google_meet', 'demo', 'upload');
CREATE TYPE public.meeting_status AS ENUM (
  'scheduled',
  'joining',
  'recording',
  'processing',
  'completed',
  'failed'
);
CREATE TYPE public.action_item_status AS ENUM ('pending', 'completed');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_url TEXT,
  source public.meeting_source NOT NULL DEFAULT 'demo',
  status public.meeting_status NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX meetings_user_id_idx ON public.meetings(user_id);
CREATE INDEX meetings_status_idx ON public.meetings(status);
CREATE INDEX meetings_created_at_idx ON public.meetings(created_at DESC);

CREATE TABLE public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX meeting_participants_meeting_id_idx ON public.meeting_participants(meeting_id);

CREATE TABLE public.transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  start_time NUMERIC(10, 2) NOT NULL DEFAULT 0,
  end_time NUMERIC(10, 2),
  sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX transcript_segments_meeting_id_idx ON public.transcript_segments(meeting_id);
CREATE INDEX transcript_segments_sequence_idx ON public.transcript_segments(meeting_id, sequence);
CREATE INDEX transcript_segments_text_search_idx
  ON public.transcript_segments USING gin (to_tsvector('english', text));

CREATE TABLE public.meeting_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL UNIQUE REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.meeting_key_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp_seconds NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX meeting_key_points_meeting_id_idx ON public.meeting_key_points(meeting_id);

CREATE TABLE public.meeting_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  timestamp_seconds NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX meeting_decisions_meeting_id_idx ON public.meeting_decisions(meeting_id);

CREATE TABLE public.meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  assignee TEXT,
  due_date TEXT,
  status public.action_item_status NOT NULL DEFAULT 'pending',
  timestamp_seconds NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX meeting_action_items_meeting_id_idx ON public.meeting_action_items(meeting_id);
CREATE INDEX meeting_action_items_status_idx ON public.meeting_action_items(status);

CREATE TABLE public.ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_logs_meeting_id_idx ON public.ai_logs(meeting_id);
CREATE INDEX ai_logs_operation_idx ON public.ai_logs(operation);

CREATE TABLE public.google_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER meetings_set_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER meeting_analysis_set_updated_at
  BEFORE UPDATE ON public.meeting_analysis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER meeting_action_items_set_updated_at
  BEFORE UPDATE ON public.meeting_action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER google_integrations_set_updated_at
  BEFORE UPDATE ON public.google_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.owns_meeting(p_meeting_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = p_meeting_id AND m.user_id = auth.uid()
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_key_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own meetings"
  ON public.meetings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meetings"
  ON public.meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meetings"
  ON public.meetings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meetings"
  ON public.meetings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own meeting participants"
  ON public.meeting_participants FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own meeting participants"
  ON public.meeting_participants FOR INSERT WITH CHECK (public.owns_meeting(meeting_id));
CREATE POLICY "Users can update own meeting participants"
  ON public.meeting_participants FOR UPDATE USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can delete own meeting participants"
  ON public.meeting_participants FOR DELETE USING (public.owns_meeting(meeting_id));

CREATE POLICY "Users can view own transcript segments"
  ON public.transcript_segments FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own transcript segments"
  ON public.transcript_segments FOR INSERT WITH CHECK (public.owns_meeting(meeting_id));
CREATE POLICY "Users can update own transcript segments"
  ON public.transcript_segments FOR UPDATE USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can delete own transcript segments"
  ON public.transcript_segments FOR DELETE USING (public.owns_meeting(meeting_id));

CREATE POLICY "Users can view own meeting analysis"
  ON public.meeting_analysis FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own meeting analysis"
  ON public.meeting_analysis FOR INSERT WITH CHECK (public.owns_meeting(meeting_id));
CREATE POLICY "Users can update own meeting analysis"
  ON public.meeting_analysis FOR UPDATE USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can delete own meeting analysis"
  ON public.meeting_analysis FOR DELETE USING (public.owns_meeting(meeting_id));

CREATE POLICY "Users can view own key points"
  ON public.meeting_key_points FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own key points"
  ON public.meeting_key_points FOR INSERT WITH CHECK (public.owns_meeting(meeting_id));
CREATE POLICY "Users can update own key points"
  ON public.meeting_key_points FOR UPDATE USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can delete own key points"
  ON public.meeting_key_points FOR DELETE USING (public.owns_meeting(meeting_id));

CREATE POLICY "Users can view own decisions"
  ON public.meeting_decisions FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own decisions"
  ON public.meeting_decisions FOR INSERT WITH CHECK (public.owns_meeting(meeting_id));
CREATE POLICY "Users can update own decisions"
  ON public.meeting_decisions FOR UPDATE USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can delete own decisions"
  ON public.meeting_decisions FOR DELETE USING (public.owns_meeting(meeting_id));

CREATE POLICY "Users can view own action items"
  ON public.meeting_action_items FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own action items"
  ON public.meeting_action_items FOR INSERT WITH CHECK (public.owns_meeting(meeting_id));
CREATE POLICY "Users can update own action items"
  ON public.meeting_action_items FOR UPDATE USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can delete own action items"
  ON public.meeting_action_items FOR DELETE USING (public.owns_meeting(meeting_id));

CREATE POLICY "Users can view own ai logs"
  ON public.ai_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai logs"
  ON public.ai_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own google integration"
  ON public.google_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own google integration"
  ON public.google_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own google integration"
  ON public.google_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own google integration"
  ON public.google_integrations FOR DELETE USING (auth.uid() = user_id);
