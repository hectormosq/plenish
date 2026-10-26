import type { SupabaseClient } from '@supabase/supabase-js';

export interface FakeHousehold {
  id: string;
  name: string;
  role: 'admin' | 'member';
  coMemberIds: string[];
}

export const EVAL_USER_ID = '00000000-0000-4000-8000-000000000001';

export const EVAL_HOUSEHOLD: FakeHousehold = {
  id: '00000000-0000-4000-8000-0000000000aa',
  name: 'Casa Eval',
  role: 'admin',
  coMemberIds: [
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
  ],
};

/**
 * Minimal read-only stand-in for the Supabase client, covering only the
 * queries the system-prompt builders run. No diet profile row is returned,
 * so prompts fall back to the default profile.
 */
export function createFakeSupabase(household: FakeHousehold | null): SupabaseClient {
  const from = (table: string) => {
    let columns = '';

    const resolve = () => {
      if (table === 'household_members' && household) {
        if (columns.includes('households(')) {
          return {
            data: {
              household_id: household.id,
              role: household.role,
              households: { name: household.name, id: household.id },
            },
            error: null,
          };
        }
        return {
          data: household.coMemberIds.map((user_id) => ({ user_id, role: 'member' })),
          error: null,
        };
      }
      return { data: null, error: null };
    };

    const builder = {
      select(cols: string) {
        columns = cols;
        return builder;
      },
      eq: () => builder,
      neq: () => builder,
      maybeSingle: async () => resolve(),
      single: async () => resolve(),
      then: (onFulfilled: (value: ReturnType<typeof resolve>) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled),
    };
    return builder;
  };

  return { from } as unknown as SupabaseClient;
}

export interface FakeIngredientRow {
  meal_log_id: string;
  dish_key: string;
  dish_name: string;
  name: string;
  quantity_g: number;
  position: number;
  created_at: string;
  meal_logs: { eaten_at: string; nutrition: unknown };
}

/**
 * Stand-in for the tables the v2 logging pipeline reads and writes:
 * ai_pipeline_runs writes are accepted and dropped; meal_log_ingredients
 * returns the given history rows filtered by dish_key / meal_log_id.
 */
export function createLogV2FakeSupabase(history: FakeIngredientRow[] = []): SupabaseClient {
  const from = (table: string) => {
    const filters: Record<string, unknown[]> = {};
    const resolve = () => {
      if (table !== 'meal_log_ingredients') return { data: table === 'ai_pipeline_runs' ? { id: 'run' } : null, error: null };
      let rows = history;
      if (filters.dish_key) rows = rows.filter((r) => filters.dish_key.includes(r.dish_key));
      if (filters.meal_log_id) rows = rows.filter((r) => filters.meal_log_id.includes(r.meal_log_id));
      return { data: [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)), error: null };
    };
    const builder = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      eq: () => builder,
      in: (column: string, values: unknown[]) => { filters[column] = values; return builder; },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => resolve(),
      single: async () => resolve(),
      then: (onFulfilled: (value: ReturnType<typeof resolve>) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
    };
    return builder;
  };
  const auth = { getUser: async () => ({ data: { user: { id: EVAL_USER_ID } }, error: null }) };
  return { from, auth } as unknown as SupabaseClient;
}
