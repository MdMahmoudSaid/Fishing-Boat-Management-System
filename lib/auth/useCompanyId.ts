"use client";

import { useQuery } from "@powersync/react";
import { useSession } from "@/lib/supabase/AuthProvider";

interface UserRow {
  company_id: string;
}

// Lecture locale (SQLite), réactive : reflète la ligne `users` synchronisée
// par PowerSync pour l'utilisateur connecté. Utilisé par tous les formulaires
// de création qui doivent renseigner company_id.
export function useCompanyId(): { companyId: string | null; loading: boolean } {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data, isLoading } = useQuery<UserRow>(
    "SELECT company_id FROM users WHERE id = ?",
    [userId ?? ""],
  );

  if (!userId) {
    return { companyId: null, loading: false };
  }

  return { companyId: data?.[0]?.company_id ?? null, loading: isLoading };
}
