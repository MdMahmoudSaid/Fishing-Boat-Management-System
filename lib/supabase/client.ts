import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définis (voir .env.example)",
  );
}

// persistSession : la session est écrite dans localStorage et relue au
// démarrage sans appel réseau, condition nécessaire pour que l'app s'ouvre
// hors-ligne après un premier login (§6). autoRefreshToken : rafraîchit le
// jeton silencieusement dès qu'une connexion est disponible.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
