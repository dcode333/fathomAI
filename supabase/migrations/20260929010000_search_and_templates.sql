-- Store which summary template produced the analysis
ALTER TABLE public.meeting_analysis
  ADD COLUMN IF NOT EXISTS template_id TEXT NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS meeting_analysis_summary_search_idx
  ON public.meeting_analysis USING gin (to_tsvector('english', summary));

CREATE INDEX IF NOT EXISTS meetings_title_search_idx
  ON public.meetings USING gin (to_tsvector('english', title));

-- Cross-meeting content search for the current user
CREATE OR REPLACE FUNCTION public.search_user_meeting_ids(search_query text)
RETURNS TABLE (meeting_id uuid, match_snippet text, match_source text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH q AS (
    SELECT trim(search_query) AS term
  ),
  hits AS (
    SELECT m.id AS meeting_id,
           left(m.title, 160) AS match_snippet,
           'title'::text AS match_source,
           1 AS rank
    FROM meetings m, q
    WHERE m.user_id = auth.uid()
      AND q.term <> ''
      AND m.title ILIKE '%' || q.term || '%'

    UNION ALL

    SELECT a.meeting_id,
           left(a.summary, 160),
           'summary',
           2
    FROM meeting_analysis a
    JOIN meetings m ON m.id = a.meeting_id
    CROSS JOIN q
    WHERE m.user_id = auth.uid()
      AND q.term <> ''
      AND a.summary ILIKE '%' || q.term || '%'

    UNION ALL

    SELECT t.meeting_id,
           left(t.speaker || ': ' || t.text, 160),
           'transcript',
           3
    FROM transcript_segments t
    JOIN meetings m ON m.id = t.meeting_id
    CROSS JOIN q
    WHERE m.user_id = auth.uid()
      AND q.term <> ''
      AND t.text ILIKE '%' || q.term || '%'

    UNION ALL

    SELECT ai.meeting_id,
           left(ai.task, 160),
           'action_item',
           4
    FROM meeting_action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    CROSS JOIN q
    WHERE m.user_id = auth.uid()
      AND q.term <> ''
      AND ai.task ILIKE '%' || q.term || '%'

    UNION ALL

    SELECT kp.meeting_id,
           left(kp.content, 160),
           'key_point',
           5
    FROM meeting_key_points kp
    JOIN meetings m ON m.id = kp.meeting_id
    CROSS JOIN q
    WHERE m.user_id = auth.uid()
      AND q.term <> ''
      AND kp.content ILIKE '%' || q.term || '%'

    UNION ALL

    SELECT d.meeting_id,
           left(d.decision, 160),
           'decision',
           6
    FROM meeting_decisions d
    JOIN meetings m ON m.id = d.meeting_id
    CROSS JOIN q
    WHERE m.user_id = auth.uid()
      AND q.term <> ''
      AND d.decision ILIKE '%' || q.term || '%'
  ),
  best AS (
    SELECT DISTINCT ON (meeting_id)
      meeting_id, match_snippet, match_source
    FROM hits
    ORDER BY meeting_id, rank ASC
  )
  SELECT meeting_id, match_snippet, match_source FROM best;
$$;

GRANT EXECUTE ON FUNCTION public.search_user_meeting_ids(text) TO authenticated;
