// Codes d'erreur Postgres qui ne peuvent JAMAIS réussir en réessayant —
// voir lib/powersync/BackendConnector.ts pour le détail du problème que ça
// résout (file de synchro PowerSync bloquée en FIFO). Partagé entre le
// connecteur PowerSync (client) et /api/sync/write (serveur) pour que les
// deux bouts s'accordent sur le même contrat.
export const NON_RETRYABLE_POSTGRES_ERROR_CODES = new Set([
  "42501", // insufficient_privilege — violation RLS
  "23505", // unique_violation
  "23503", // foreign_key_violation
  "23514", // check_violation
  "23502", // not_null_violation
  "22P02", // invalid_text_representation (ex : UUID malformé)
  "42703", // undefined_column
  "42P01", // undefined_table
]) as ReadonlySet<string>;
