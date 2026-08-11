import { beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "./jwt";
import { verifyAccessToken } from "./verifyAccessToken";

describe("signAccessToken / verifyAccessToken", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-secret-do-not-use-in-prod");
  });

  it("un token signé se vérifie et restitue les claims", async () => {
    const token = await signAccessToken({ sub: "user-1", companyId: "company-1", role: "owner" });
    const claims = await verifyAccessToken(token);
    expect(claims).toEqual({ sub: "user-1", companyId: "company-1", role: "owner" });
  });

  it("rejette un token signé avec un autre secret", async () => {
    const token = await signAccessToken({ sub: "user-1", companyId: "company-1", role: "owner" });
    vi.stubEnv("JWT_SECRET", "another-secret");
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("rejette une chaîne qui n'est pas un JWT", async () => {
    await expect(verifyAccessToken("not-a-jwt")).rejects.toThrow();
  });
});
