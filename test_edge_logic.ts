import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabaseUrl = Deno.env.get('EXPO_PUBLIC_SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('EXPO_PUBLIC_SUPABASE_ANON_KEY') || '';
// We can't use Service Role here without it, let me check if there's a `.env` file first.
