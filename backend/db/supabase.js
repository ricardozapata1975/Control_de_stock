import { createClient } from '@supabase/supabase-js';
import { config, assertConfig } from '../config.js';

let client = null;

export function getSupabase() {
  if (!client) {
    assertConfig();
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
