import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from "@powersync/web";
import { supabase } from "@/lib/supabase/client";

const powersyncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;

// Codes d'erreur Postgres qui ne peuvent JAMAIS réussir en réessayant : la
// requête est structurellement invalide (droits, contrainte, donnée
// malformée), pas un problème réseau. Sans cette distinction, une seule
// écriture locale invalide (ex : reliquat d'une session avec un mauvais
// company_id) bloque indéfiniment TOUTE la file de synchro PowerSync — les
// transactions sont traitées en FIFO, donc tant que la première ne se
// termine pas (par succès ou par transaction.complete() explicite), aucune
// écriture suivante n'est jamais envoyée. Voir la doc PowerSync sur les
// "non-retryable" errors des connecteurs Supabase.
const NON_RETRYABLE_POSTGRES_ERROR_CODES = new Set([
  "42501", // insufficient_privilege — violation RLS
  "23505", // unique_violation
  "23503", // foreign_key_violation
  "23514", // check_violation
  "23502", // not_null_violation
  "22P02", // invalid_text_representation (ex : UUID malformé)
  "42703", // undefined_column
  "42P01", // undefined_table
]);

function isNonRetryableError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && NON_RETRYABLE_POSTGRES_ERROR_CODES.has(code);
}

export class BackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    if (!powersyncUrl) {
      throw new Error(
        "NEXT_PUBLIC_POWERSYNC_URL doit être défini (voir .env.example)",
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Aucune session Supabase active — connexion requise");
    }

    return {
      endpoint: powersyncUrl,
      token: session.access_token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      const table = supabase.from(op.table);

      try {
        switch (op.op) {
          case UpdateType.PUT:
            await table.upsert({ ...op.opData, id: op.id }).throwOnError();
            break;
          case UpdateType.PATCH:
            await table.update(op.opData ?? {}).eq("id", op.id).throwOnError();
            break;
          case UpdateType.DELETE:
            await table.delete().eq("id", op.id).throwOnError();
            break;
        }
      } catch (error) {
        if (isNonRetryableError(error)) {
          // Erreur permanente (RLS, contrainte, donnée invalide...) :
          // réessayer ne changera rien. On l'écarte pour ne pas bloquer
          // indéfiniment le reste de la file de synchro. C'est un cas géré
          // avec succès (pas une panne en cours) : console.warn plutôt que
          // console.error pour ne pas déclencher l'overlay plein écran du
          // dev server de Next.js, tout en restant visible dans la console.
          console.warn(
            `[SYNC] Écriture locale rejetée définitivement et écartée — table="${op.table}" op="${op.op}" id="${op.id}"`,
            { opData: op.opData, error },
          );
          continue;
        }

        // Erreur réseau/transitoire : ne pas compléter la transaction,
        // PowerSync retentera automatiquement ce même lot à la prochaine
        // tentative de synchronisation.
        console.error("Échec de synchronisation des écritures locales", error);
        throw error;
      }
    }

    await transaction.complete();
  }
}
