-- Store Google Meet recording pointers for synced playback
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS recording_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS recording_export_uri TEXT,
  ADD COLUMN IF NOT EXISTS recording_state TEXT,
  ADD COLUMN IF NOT EXISTS conference_record_name TEXT;
