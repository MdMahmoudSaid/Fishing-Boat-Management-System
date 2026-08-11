"use client";

import React, { Suspense, useEffect } from "react";
import { PowerSyncContext } from "@powersync/react";
import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "./AppSchema";
import { BackendConnector } from "./BackendConnector";
import { useSession } from "@/lib/auth/AuthProvider";

let dbInstance: PowerSyncDatabase | null = null;
// `PowerSyncDatabase` n'expose pas publiquement si connect() a déjà été
// appelé (son getter `connector` n'est pas dans le type `@powersync/web`) —
// on suit donc nous-mêmes cet état, à côté du singleton.
let isConnectRequested = false;

function getDB(): PowerSyncDatabase {
  if (dbInstance) return dbInstance;

  dbInstance = new PowerSyncDatabase({
    schema: AppSchema,
    // Pas de `worker` custom : le SDK v2 résout et bundle son worker par
    // défaut via `new URL('./worker.js', import.meta.url)`, que webpack
    // sait gérer nativement (contrairement à Turbopack).
    database: {
      dbFilename: "powersync.db",
      disableSSRWarning: true,
    },
  });

  // Pas de connect() ici : la connexion attend une session confirmée (voir
  // usePowerSyncAuthLifecycle ci-dessous). Se connecter au montage, avant
  // que l'auth soit résolue, fait échouer fetchCredentials() en boucle
  // ("Aucune session active") tant que l'utilisateur n'est pas connecté.
  return dbInstance;
}

// Connecte/déconnecte PowerSync en suivant l'état de la session, plutôt que
// de se connecter en aveugle au montage. Sans ça, PowerSync tente de syncer
// avant la connexion de l'utilisateur (et reste connecté après un logout),
// donc fetchCredentials() échoue en boucle avec "Aucune session active" —
// bruit console et "Issue" remontée par l'overlay dev de Next.js, puisque le
// logger par défaut de PowerSync journalise via console.error à ce niveau.
function usePowerSyncAuthLifecycle(db: PowerSyncDatabase) {
  const { session, loading } = useSession();

  useEffect(() => {
    // Session pas encore lue depuis le stockage local : ne rien faire tant
    // qu'on ne sait pas si l'utilisateur est connecté.
    if (loading) return;

    if (session) {
      if (!isConnectRequested) {
        isConnectRequested = true;
        db.connect(new BackendConnector());
      }
    } else if (isConnectRequested) {
      isConnectRequested = false;
      db.disconnect().catch((error) => {
        console.error("Échec de déconnexion de PowerSync", error);
      });
    }
  }, [db, session, loading]);
}

export function PowerSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const db = getDB();
  usePowerSyncAuthLifecycle(db);

  return (
    <Suspense>
      <PowerSyncContext.Provider value={db}>
        {children}
      </PowerSyncContext.Provider>
    </Suspense>
  );
}
