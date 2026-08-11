// lib/auth/session.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, needsRefresh, readSession, subscribeSessionChange, writeSession } from "./session";

function memoryLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  };
}

const SESSION = {
  accessToken: "a",
  refreshToken: "r",
  expiresAt: Date.now() + 60_000,
  user: { id: "u1" },
};

describe("session storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryLocalStorage());
  });

  it("retourne null si rien n'est stocké", () => {
    expect(readSession()).toBeNull();
  });

  it("écrit puis relit la même session", () => {
    writeSession(SESSION);
    expect(readSession()).toEqual(SESSION);
  });

  it("clearSession efface la session stockée", () => {
    writeSession(SESSION);
    clearSession();
    expect(readSession()).toBeNull();
  });

  it("notifie les abonnés à chaque écriture/effacement", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionChange(listener);
    writeSession(SESSION);
    clearSession();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("needsRefresh", () => {
  it("faux pour une session encore loin de l'expiration", () => {
    expect(needsRefresh({ ...SESSION, expiresAt: Date.now() + 60 * 60 * 1000 })).toBe(false);
  });

  it("vrai pour une session déjà expirée", () => {
    expect(needsRefresh({ ...SESSION, expiresAt: Date.now() - 1000 })).toBe(true);
  });

  it("vrai dans la marge de rafraîchissement anticipé (5 min avant expiration)", () => {
    expect(needsRefresh({ ...SESSION, expiresAt: Date.now() + 60 * 1000 })).toBe(true);
  });
});
