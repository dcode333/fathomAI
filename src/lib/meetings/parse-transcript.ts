/**
 * Parse pasted meeting notes into transcript segments.
 * Supports:
 * - "Sarah: Hello"
 * - "[2:04] Sarah: Hello"
 * - "Sarah - Hello"
 */
export function parseTranscriptText(raw: string): {
  speaker: string;
  text: string;
  start_time: number;
  end_time: number | null;
  sequence: number;
}[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const segments: {
    speaker: string;
    text: string;
    start_time: number;
    end_time: number | null;
    sequence: number;
  }[] = [];

  let cursor = 0;

  for (const line of lines) {
    const stamped = line.match(
      /^\[?\s*(\d{1,2}):(\d{2})\s*\]?\s*[-–—]?\s*([^:–—-]+)\s*[:–—-]\s*(.+)$/i
    );
    const plain = line.match(/^([^:–—-]{1,40})\s*[:–—-]\s*(.+)$/);

    if (stamped) {
      const minutes = Number(stamped[1]);
      const seconds = Number(stamped[2]);
      const start_time = minutes * 60 + seconds;
      segments.push({
        speaker: stamped[3].trim(),
        text: stamped[4].trim(),
        start_time,
        end_time: null,
        sequence: segments.length,
      });
      cursor = start_time + 8;
      continue;
    }

    if (plain) {
      segments.push({
        speaker: plain[1].trim(),
        text: plain[2].trim(),
        start_time: cursor,
        end_time: null,
        sequence: segments.length,
      });
      cursor += 12;
      continue;
    }

    // Continuation line — attach to previous speaker if any
    if (segments.length) {
      const last = segments[segments.length - 1];
      last.text = `${last.text} ${line}`.trim();
    } else {
      segments.push({
        speaker: "Speaker",
        text: line,
        start_time: cursor,
        end_time: null,
        sequence: 0,
      });
      cursor += 12;
    }
  }

  return segments;
}
