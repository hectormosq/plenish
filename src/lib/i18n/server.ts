import { createClient } from '@/lib/supabase/server';
import { toLang } from './index';
import type { Lang } from './index';

/**
 * UI language of the signed-in user (users.default_language), for Server
 * Components to pass down as a `lang` prop. Spanish when unknown.
 */
export async function getUserLang(): Promise<Lang> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'es';
  const { data } = await supabase.from('users').select('default_language').eq('id', user.id).maybeSingle();
  return toLang(data?.default_language);
}
