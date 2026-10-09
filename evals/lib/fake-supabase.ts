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
