import { describe, expect, it } from "vitest";
import { generateId } from "./generateId";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  it("returns a valid UUID v4, generatable without any network/DB round-trip", () => {
    expect(generateId()).toMatch(UUID_V4_REGEX);
  });

  it("returns a different id on each call", () => {
    expect(generateId()).not.toBe(generateId());
  });
});
