import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from "@powersync/web";
import { readSession } from "@/lib/auth/session";
import { NON_RETRYABLE_POSTGRES_ERROR_CODES } from "@/lib/postgres/postgresErrorCodes";

const powersyncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;

function isNonRetryableError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && NON_RETRYABLE_POSTGRES_ERROR_CODES.has(code);
}

class SyncWriteRequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function syncWrite(
  table: string,
  op: UpdateType,
  id: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const session = readSession();
  if (!session) {
    throw new Error("Aucune session active — connexion requise");
  }

  const response = await fetch("/api/sync/write", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify({ table, op, id, data }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new SyncWriteRequestError(body.message ?? `Échec de synchro (${response.status})`, body.code);
  }
}

export class BackendConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    if (!powersyncUrl) {
      throw new Error(
        "NEXT_PUBLIC_POWERSYNC_URL doit être défini (voir .env.example)",
      );
    }

    const session = readSession();
    if (!session) {
      throw new Error("Aucune session active — connexion requise");
    }

    return {
      endpoint: powersyncUrl,
      token: session.accessToken,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      try {
        await syncWrite(op.table, op.op, op.id, op.opData);
      } catch (error) {
        if (isNonRetryableError(error)) {
          // Erreur permanente (RLS, contrainte, donnée invalide...) :
          // réessayer ne changera rien. On l'écarte pour ne pas bloquer
          // indéfiniment le reste de la file de synchro.
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
