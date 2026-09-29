-- Mid-call / review highlights
CREATE TABLE IF NOT EXISTS public.meeting_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0,
  speaker TEXT,
  quote TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meeting_highlights_meeting_id_idx
  ON public.meeting_highlights(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_highlights_timestamp_idx
  ON public.meeting_highlights(meeting_id, timestamp_seconds);

ALTER TABLE public.meeting_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting highlights"
  ON public.meeting_highlights FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own meeting highlights"
  ON public.meeting_highlights FOR INSERT WITH CHECK (public.owns_meeting(meeting_id) AND auth.uid() = user_id);
CREATE POLICY "Users can update own meeting highlights"
  ON public.meeting_highlights FOR UPDATE USING (public.owns_meeting(meeting_id) AND auth.uid() = user_id);
CREATE POLICY "Users can delete own meeting highlights"
  ON public.meeting_highlights FOR DELETE USING (public.owns_meeting(meeting_id) AND auth.uid() = user_id);

-- Shareable clips for non-attendees
CREATE TABLE IF NOT EXISTS public.meeting_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES public.meeting_highlights(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  title TEXT,
  quote TEXT NOT NULL,
  speaker TEXT,
  start_seconds NUMERIC(10, 2) NOT NULL DEFAULT 0,
  end_seconds NUMERIC(10, 2),
  note TEXT,
  meeting_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meeting_clips_meeting_id_idx ON public.meeting_clips(meeting_id);
CREATE UNIQUE INDEX IF NOT EXISTS meeting_clips_share_token_idx ON public.meeting_clips(share_token);

ALTER TABLE public.meeting_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting clips"
  ON public.meeting_clips FOR SELECT USING (public.owns_meeting(meeting_id));
CREATE POLICY "Users can insert own meeting clips"
  ON public.meeting_clips FOR INSERT WITH CHECK (public.owns_meeting(meeting_id) AND auth.uid() = created_by);
CREATE POLICY "Users can delete own meeting clips"
  ON public.meeting_clips FOR DELETE USING (public.owns_meeting(meeting_id) AND auth.uid() = created_by);

CREATE OR REPLACE FUNCTION public.get_public_clip(p_token text)
RETURNS TABLE (
  id uuid,
  title text,
  quote text,
  speaker text,
  start_seconds numeric,
  end_seconds numeric,
  note text,
  meeting_title text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.quote,
    c.speaker,
    c.start_seconds,
    c.end_seconds,
    c.note,
    COALESCE(c.meeting_title, m.title),
    c.created_at
  FROM public.meeting_clips c
  JOIN public.meetings m ON m.id = c.meeting_id
  WHERE c.share_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_clip(text) TO anon, authenticated;
