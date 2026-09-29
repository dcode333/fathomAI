import { extractMeetingCode } from "@/lib/google/config";

type MeetSpace = {
  name?: string;
  meetingUri?: string;
  meetingCode?: string;
};

type ConferenceRecord = {
  name?: string;
  startTime?: string;
  endTime?: string;
  space?: string;
};

type Transcript = {
  name?: string;
  state?: string;
  startTime?: string;
  endTime?: string;
  docsDestination?: {
    document?: string;
    exportUri?: string;
  };
};

type TranscriptEntry = {
  name?: string;
  participant?: string;
  text?: string;
  languageCode?: string;
  startTime?: string;
  endTime?: string;
};

type MeetRecording = {
  name?: string;
  state?: string;
  startTime?: string;
  endTime?: string;
  driveDestination?: {
    file?: string;
    exportUri?: string;
  };
};

function parseMeetClockSeconds(
  value: string | null | undefined,
  epochMs: number | null
): { seconds: number; absoluteMs: number | null } {
  if (!value) return { seconds: 0, absoluteMs: null };

  // Duration form: "3.5s" (older docs / some fields)
  const duration = value.match(/^(\d+(?:\.\d+)?)s$/i);
  if (duration) {
    return { seconds: Math.floor(Number(duration[1])), absoluteMs: null };
  }

  // ISO-8601 duration: PT1M2.5S
  const isoDur = value.match(
    /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)$/i
  );
  if (isoDur) {
    const hours = Number(isoDur[1] ?? 0);
    const mins = Number(isoDur[2] ?? 0);
    const secs = Number(isoDur[3] ?? 0);
    return {
      seconds: Math.floor(hours * 3600 + mins * 60 + secs),
      absoluteMs: null,
    };
  }

  // Absolute timestamp (current Meet transcriptEntries startTime / endTime)
  const absoluteMs = Date.parse(value);
  if (!Number.isNaN(absoluteMs)) {
    if (epochMs != null) {
      return {
        seconds: Math.max(0, Math.floor((absoluteMs - epochMs) / 1000)),
        absoluteMs,
      };
    }
    return { seconds: 0, absoluteMs };
  }

  return { seconds: 0, absoluteMs: null };
}

/** When Google returns missing/zero clocks, spread segments by word count. */
export function estimateSegmentTimes<
  T extends { text: string; start_time: number; end_time: number | null },
>(segments: T[], totalDurationSeconds?: number | null): T[] {
  const allZero = segments.every((s) => !s.start_time && !s.end_time);
  if (!allZero || segments.length === 0) return segments;

  const weights = segments.map((s) =>
    Math.max(1, s.text.trim().split(/\s+/).length)
  );
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const total = Math.max(
    totalDurationSeconds ?? 0,
    Math.ceil(weightSum / 2.5), // ~150 wpm speech
    segments.length * 3
  );

  let cursor = 0;
  return segments.map((seg, i) => {
    const share = weights[i] / weightSum;
    const dur = Math.max(2, Math.round(share * total));
    const start = cursor;
    const end = i === segments.length - 1 ? total : start + dur;
    cursor = end;
    return { ...seg, start_time: start, end_time: end };
  });
}

/**
 * Align transcript clocks to the video timeline.
 * Meet entry times are often relative to conference start, while the MP4
 * starts when Recording began — so we shift the first cue to 0:00 and
 * optionally scale to fit the media duration.
 */
export function rebaseSegmentsToMediaTimeline<
  T extends { start_time: number; end_time: number | null },
>(
  segments: T[],
  options?: {
    /** Absolute offset already applied (e.g. recording start − conference start). */
    offsetSeconds?: number;
    mediaDurationSeconds?: number | null;
  }
): T[] {
  if (!segments.length) return segments;

  const offset =
    options?.offsetSeconds ??
    Math.min(...segments.map((s) => Number(s.start_time) || 0));

  let rebased = segments.map((s) => ({
    ...s,
    start_time: Math.max(0, Math.floor(Number(s.start_time) - offset)),
    end_time:
      s.end_time != null
        ? Math.max(0, Math.floor(Number(s.end_time) - offset))
        : null,
  }));

  const mediaDur = options?.mediaDurationSeconds;
  if (mediaDur && mediaDur > 1) {
    const maxT = Math.max(
      ...rebased.map((s) => Number(s.end_time ?? s.start_time) || 0),
      0
    );
    if (maxT > mediaDur + 2) {
      const scale = mediaDur / maxT;
      rebased = rebased.map((s) => ({
        ...s,
        start_time: Math.floor(s.start_time * scale),
        end_time:
          s.end_time != null ? Math.floor(s.end_time * scale) : null,
      }));
    }
  }

  return rebased;
}

async function meetFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`https://meet.googleapis.com/v2/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meet API ${response.status}: ${body.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

/**
 * Create a Meet space. Tries to enable auto-transcription when the account allows it.
 */
export async function createMeetSpace(accessToken: string): Promise<{
  meetUrl: string;
  meetingCode: string | null;
  spaceName: string | null;
}> {
  let space: MeetSpace;

  try {
    space = await meetFetch<MeetSpace>(accessToken, "spaces", {
      method: "POST",
      body: JSON.stringify({
        config: {
          accessType: "OPEN",
          artifactConfig: {
            transcriptionConfig: {
              autoTranscriptionGeneration: "ON",
            },
          },
        },
      }),
    });
  } catch {
    // Auto-transcription config often requires Workspace policies — create a plain space.
    space = await meetFetch<MeetSpace>(accessToken, "spaces", {
      method: "POST",
      body: JSON.stringify({
        config: { accessType: "OPEN" },
      }),
    });
  }

  const meetUrl = space.meetingUri;
  if (!meetUrl) {
    throw new Error("Meet API created a space but returned no meeting URL.");
  }

  return {
    meetUrl,
    meetingCode: space.meetingCode?.toLowerCase() ?? extractMeetingCode(meetUrl),
    spaceName: space.name ?? null,
  };
}

export async function listConferenceRecordsForMeetingCode(
  accessToken: string,
  meetingCode: string
): Promise<ConferenceRecord[]> {
  const filter = encodeURIComponent(`space.meeting_code="${meetingCode}"`);
  const data = await meetFetch<{ conferenceRecords?: ConferenceRecord[] }>(
    accessToken,
    `conferenceRecords?filter=${filter}`
  );
  return data.conferenceRecords ?? [];
}

/**
 * Lightweight status check — used to detect when a Meet conference has ended
 * before we spend tokens on full transcript/recording import.
 */
export async function getMeetConferenceStatus(options: {
  accessToken: string;
  meetingUrl: string;
}): Promise<{
  found: boolean;
  ended: boolean;
  conferenceRecord: string | null;
  startTime: string | null;
  endTime: string | null;
}> {
  const code = extractMeetingCode(options.meetingUrl);
  if (!code) {
    return {
      found: false,
      ended: false,
      conferenceRecord: null,
      startTime: null,
      endTime: null,
    };
  }

  const records = await listConferenceRecordsForMeetingCode(
    options.accessToken,
    code
  );
  if (!records.length) {
    return {
      found: false,
      ended: false,
      conferenceRecord: null,
      startTime: null,
      endTime: null,
    };
  }

  const sorted = [...records].sort((a, b) => {
    const at = a.startTime ? Date.parse(a.startTime) : 0;
    const bt = b.startTime ? Date.parse(b.startTime) : 0;
    return bt - at;
  });
  const latest = sorted[0];

  return {
    found: true,
    ended: Boolean(latest.endTime),
    conferenceRecord: latest.name ?? null,
    startTime: latest.startTime ?? null,
    endTime: latest.endTime ?? null,
  };
}

export async function listTranscripts(
  accessToken: string,
  conferenceRecordName: string
): Promise<Transcript[]> {
  // conferenceRecordName is like "conferenceRecords/xxx"
  const data = await meetFetch<{ transcripts?: Transcript[] }>(
    accessToken,
    `${conferenceRecordName}/transcripts`
  );
  return data.transcripts ?? [];
}

export async function listTranscriptEntries(
  accessToken: string,
  transcriptName: string
): Promise<TranscriptEntry[]> {
  const entries: TranscriptEntry[] = [];
  let pageToken: string | undefined;

  do {
    const qs = pageToken
      ? `?pageSize=100&pageToken=${encodeURIComponent(pageToken)}`
      : "?pageSize=100";
    const data = await meetFetch<{
      transcriptEntries?: TranscriptEntry[];
      nextPageToken?: string;
    }>(accessToken, `${transcriptName}/entries${qs}`);
    entries.push(...(data.transcriptEntries ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return entries;
}

export async function listRecordings(
  accessToken: string,
  conferenceRecordName: string
): Promise<MeetRecording[]> {
  const data = await meetFetch<{ recordings?: MeetRecording[] }>(
    accessToken,
    `${conferenceRecordName}/recordings`
  );
  return data.recordings ?? [];
}

export type MeetRecordingResult = {
  conferenceRecord: string;
  recordingName: string | null;
  driveFileId: string | null;
  exportUri: string | null;
  state: string | null;
  startTime: string | null;
  endTime: string | null;
  durationSeconds: number | null;
};

/**
 * Find the newest ready Meet recording for a meeting URL.
 * Returns null fields when recording was never started / not ready yet.
 */
export async function fetchRecordingForMeet(options: {
  accessToken: string;
  meetingUrl: string;
  preferredConferenceRecord?: string | null;
}): Promise<MeetRecordingResult | null> {
  const code = extractMeetingCode(options.meetingUrl);
  if (!code) {
    throw new Error("Could not read a Google Meet code from the meeting URL.");
  }

  let conferenceNames: string[] = [];

  if (options.preferredConferenceRecord) {
    conferenceNames = [options.preferredConferenceRecord];
  } else {
    const records = await listConferenceRecordsForMeetingCode(
      options.accessToken,
      code
    );
    if (!records.length) return null;
    conferenceNames = [...records]
      .sort((a, b) => {
        const at = a.startTime ? Date.parse(a.startTime) : 0;
        const bt = b.startTime ? Date.parse(b.startTime) : 0;
        return bt - at;
      })
      .map((r) => r.name)
      .filter((n): n is string => Boolean(n));
  }

  for (const conferenceRecord of conferenceNames) {
    const recordings = await listRecordings(
      options.accessToken,
      conferenceRecord
    );
    if (!recordings.length) continue;

    const ready =
      recordings.find((r) => r.state === "FILE_GENERATED") ??
      recordings[recordings.length - 1];

    return {
      conferenceRecord,
      recordingName: ready.name ?? null,
      driveFileId: ready.driveDestination?.file ?? null,
      exportUri: ready.driveDestination?.exportUri ?? null,
      state: ready.state ?? null,
      startTime: ready.startTime ?? null,
      endTime: ready.endTime ?? null,
      durationSeconds:
        ready.startTime && ready.endTime
          ? Math.max(
              0,
              Math.floor(
                (Date.parse(ready.endTime) - Date.parse(ready.startTime)) /
                  1000
              )
            )
          : null,
    };
  }

  return null;
}

/**
 * Best-effort participant display name from participant resource name.
 * Full participant fetch needs another call; we keep a readable fallback.
 */
export function speakerFromParticipant(participant?: string): string {
  if (!participant) return "Speaker";
  const parts = participant.split("/");
  return parts[parts.length - 1] || "Speaker";
}

export async function fetchTranscriptSegmentsForMeet(options: {
  accessToken: string;
  meetingUrl: string;
  /** Prefer recording start so cues align with the MP4 timeline. */
  recordingStartTime?: string | null;
  mediaDurationSeconds?: number | null;
}): Promise<{
  segments: {
    speaker: string;
    text: string;
    start_time: number;
    end_time: number | null;
    sequence: number;
  }[];
  conferenceRecord: string | null;
  transcriptName: string | null;
  docsUri: string | null;
}> {
  const code = extractMeetingCode(options.meetingUrl);
  if (!code) {
    throw new Error("Could not read a Google Meet code from the meeting URL.");
  }

  const records = await listConferenceRecordsForMeetingCode(
    options.accessToken,
    code
  );

  if (!records.length) {
    throw new Error(
      "No conference record found yet. End the Meet, wait 1–2 minutes for Google to process, then retry. Also make sure transcript/take notes was enabled during the call (Workspace)."
    );
  }

  // Prefer the most recent conference
  const sorted = [...records].sort((a, b) => {
    const at = a.startTime ? Date.parse(a.startTime) : 0;
    const bt = b.startTime ? Date.parse(b.startTime) : 0;
    return bt - at;
  });

  let lastDocsUri: string | null = null;

  for (const record of sorted) {
    if (!record.name) continue;
    const transcripts = await listTranscripts(options.accessToken, record.name);
    if (!transcripts.length) continue;

    const ready =
      transcripts.find((t) => t.state === "FILE_GENERATED") ?? transcripts[0];
    lastDocsUri = ready.docsDestination?.exportUri ?? null;

    if (!ready.name) continue;

    const entries = await listTranscriptEntries(options.accessToken, ready.name);
    if (!entries.length) {
      // Docs may exist even when entries API is empty / restricted
      continue;
    }

    const speakerCache = new Map<string, string>();

    // Prefer recording start as epoch so times match the MP4; else conference start.
    const recordingEpoch = options.recordingStartTime
      ? Date.parse(options.recordingStartTime)
      : NaN;
    const conferenceEpoch = record.startTime
      ? Date.parse(record.startTime)
      : NaN;
    const epochMs = !Number.isNaN(recordingEpoch)
      ? recordingEpoch
      : !Number.isNaN(conferenceEpoch)
        ? conferenceEpoch
        : null;
    const raw: {
      speaker: string;
      text: string;
      start_time: number;
      end_time: number | null;
      sequence: number;
      absoluteStart: number | null;
    }[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const text = entry.text?.trim();
      if (!text) continue;

      let speaker = "Speaker";
      if (entry.participant) {
        if (speakerCache.has(entry.participant)) {
          speaker = speakerCache.get(entry.participant)!;
        } else {
          try {
            const participant = await meetFetch<{
              user?: { displayName?: string };
              signedinUser?: { displayName?: string };
              anonymousUser?: { displayName?: string };
            }>(options.accessToken, entry.participant);
            speaker =
              participant.signedinUser?.displayName ||
              participant.user?.displayName ||
              participant.anonymousUser?.displayName ||
              speakerFromParticipant(entry.participant);
          } catch {
            speaker = speakerFromParticipant(entry.participant);
          }
          speakerCache.set(entry.participant, speaker);
        }
      }

      const startParsed = parseMeetClockSeconds(entry.startTime, epochMs);
      const endParsed = parseMeetClockSeconds(entry.endTime, epochMs);

      raw.push({
        speaker,
        text,
        start_time: startParsed.seconds,
        end_time: entry.endTime ? endParsed.seconds : null,
        sequence: raw.length,
        absoluteStart: startParsed.absoluteMs,
      });
    }

    // Absolute timestamps with no usable epoch → rebase to earliest entry.
    const absTimes = raw
      .map((r) => r.absoluteStart)
      .filter((n): n is number => n != null);
    if (absTimes.length && raw.every((r) => !r.start_time) && epochMs == null) {
      const epoch = Math.min(...absTimes);
      for (const row of raw) {
        if (row.absoluteStart != null) {
          row.start_time = Math.max(
            0,
            Math.floor((row.absoluteStart - epoch) / 1000)
          );
        }
      }
    }

    let segments = raw.map(({ absoluteStart: _a, ...rest }) => rest);
    const conferenceDuration =
      record.startTime && record.endTime
        ? Math.max(
            0,
            Math.floor(
              (Date.parse(record.endTime) - Date.parse(record.startTime)) /
                1000
            )
          )
        : null;
    segments = estimateSegmentTimes(segments, conferenceDuration);
    // Always align to media: first cue → 0:00 (and fit recording length if known)
    segments = rebaseSegmentsToMediaTimeline(segments, {
      mediaDurationSeconds: options.mediaDurationSeconds,
    });

    if (segments.length) {
      return {
        segments,
        conferenceRecord: record.name,
        transcriptName: ready.name,
        docsUri: lastDocsUri,
      };
    }
  }

  if (lastDocsUri) {
    throw new Error(
      `Transcript Doc exists in Drive but speech entries were empty. Open it: ${lastDocsUri}`
    );
  }

  throw new Error(
    "Conference found, but no transcript yet. In Meet: Activities → Transcripts / Take notes, then end the call and wait for processing."
  );
}
