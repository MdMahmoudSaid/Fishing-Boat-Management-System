"use client";

import React, { Suspense } from "react";
import { PowerSyncContext } from "@powersync/react";
import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "./AppSchema";
import { BackendConnector } from "./BackendConnector";

let dbInstance: PowerSyncDatabase | null = null;

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

  dbInstance.connect(new BackendConnector());
  return dbInstance;
}

export function PowerSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <PowerSyncContext.Provider value={getDB()}>
        {children}
      </PowerSyncContext.Provider>
    </Suspense>
  );
}
