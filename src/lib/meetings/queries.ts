import { createClient } from "@/lib/supabase/server";
import type { MeetingListItem } from "@/lib/meetings/format";

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getMeetingsForUser(
  userId: string,
  search?: string
): Promise<MeetingListItem[]> {
  const supabase = await createClient();
  const term = search?.trim() ?? "";

  let matchById = new Map<string, { snippet: string; source: string }>();

  if (term) {
    const { data: hits, error: searchError } = await supabase.rpc(
      "search_user_meeting_ids",
      { search_query: term }
    );

    if (searchError) {
      console.error("search_user_meeting_ids", searchError.message);
      // Fallback: title-only
      const { data, error } = await supabase
        .from("meetings")
        .select(
          `
          *,
          meeting_participants ( id, name, role ),
          meeting_analysis ( summary, template_id ),
          meeting_action_items ( id, status ),
          meeting_decisions ( id )
        `
        )
        .eq("user_id", userId)
        .ilike("title", `%${term}%`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("getMeetingsForUser fallback", error.message);
        return [];
      }
      return mapRows(data ?? [], new Map());
    }

    const typedHits = hits ?? [];
    if (typedHits.length === 0) return [];

    matchById = new Map(
      typedHits.map((h) => [
        h.meeting_id,
        { snippet: h.match_snippet, source: h.match_source },
      ])
    );
  }

  let query = supabase
    .from("meetings")
    .select(
      `
      *,
      meeting_participants ( id, name, role ),
      meeting_analysis ( summary, template_id ),
      meeting_action_items ( id, status ),
      meeting_decisions ( id )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (term && matchById.size > 0) {
    query = query.in("id", [...matchById.keys()]);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getMeetingsForUser", error.message);
    return [];
  }

  return mapRows(data ?? [], matchById);
}

function mapRows(
  data: Array<Record<string, unknown> & {
    meeting_participants?: MeetingListItem["meeting_participants"];
    meeting_action_items?: MeetingListItem["meeting_action_items"];
    meeting_decisions?: MeetingListItem["meeting_decisions"];
    meeting_analysis?:
      | { summary: string; template_id?: string | null }
      | { summary: string; template_id?: string | null }[]
      | null;
  }>,
  matchById: Map<string, { snippet: string; source: string }>
): MeetingListItem[] {
  return data.map((row) => {
    const analysis = firstOrNull(row.meeting_analysis);
    const match = matchById.get(String(row.id));
    return {
      ...(row as unknown as MeetingListItem),
      meeting_participants: row.meeting_participants ?? [],
      meeting_action_items: row.meeting_action_items ?? [],
      meeting_decisions: row.meeting_decisions ?? [],
      meeting_analysis: analysis
        ? {
            summary: analysis.summary,
            template_id: analysis.template_id ?? "general",
          }
        : null,
      search_match: match
        ? { snippet: match.snippet, source: match.source }
        : null,
    } satisfies MeetingListItem;
  });
}
