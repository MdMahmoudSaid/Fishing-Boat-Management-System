import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  UpdateType,
} from "@powersync/web";
import { supabase } from "@/lib/supabase/client";

const powersyncUrl = process.env.NEXT_PUBLIC_POWERSYNC_URL;

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

    try {
      for (const op of transaction.crud) {
        const table = supabase.from(op.table);

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
      }

      await transaction.complete();
    } catch (error) {
      // Erreur réseau/transitoire : ne pas compléter la transaction, PowerSync
      // retentera automatiquement à la prochaine tentative de synchronisation.
      console.error("Échec de synchronisation des écritures locales", error);
      throw error;
    }
  }
}
