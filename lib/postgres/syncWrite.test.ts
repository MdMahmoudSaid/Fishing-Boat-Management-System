import { describe, expect, it } from "vitest";
import { assertSyncableTable, buildSyncQuery, SyncWriteError } from "./syncWrite";

describe("assertSyncableTable", () => {
  it("accepte une table métier connue", () => {
    expect(() => assertSyncableTable("boats")).not.toThrow();
  });

  it("rejette une table non autorisée avec le code 42P01", () => {
    expect(() => assertSyncableTable("companies")).toThrow(SyncWriteError);
    try {
      assertSyncableTable("companies");
    } catch (error) {
      expect((error as SyncWriteError).code).toBe("42P01");
    }
  });
});

describe("buildSyncQuery", () => {
  it("construit un DELETE paramétré", () => {
    const query = buildSyncQuery({ table: "boats", op: "DELETE", id: "b1" });
    expect(query.text).toBe("DELETE FROM boats WHERE id = $1");
    expect(query.values).toEqual(["b1"]);
  });

  it("construit un INSERT ... ON CONFLICT pour PUT", () => {
    const query = buildSyncQuery({
      table: "boats",
      op: "PUT",
      id: "b1",
      data: { company_id: "c1", name: "Amel" },
    });
    expect(query.text).toContain("INSERT INTO boats (company_id, name, id)");
    expect(query.text).toContain("ON CONFLICT (id) DO UPDATE SET company_id = excluded.company_id, name = excluded.name");
    expect(query.values).toEqual(["c1", "Amel", "b1"]);
  });

  it("construit un UPDATE pour PATCH", () => {
    const query = buildSyncQuery({
      table: "boats",
      op: "PATCH",
      id: "b1",
      data: { status: "maintenance" },
    });
    expect(query.text).toBe("UPDATE boats SET status = $1 WHERE id = $2");
    expect(query.values).toEqual(["maintenance", "b1"]);
  });

  it("rejette une colonne non autorisée avec le code 42703", () => {
    expect(() =>
      buildSyncQuery({ table: "boats", op: "PATCH", id: "b1", data: { not_a_real_column: 1 } }),
    ).toThrow(SyncWriteError);
    try {
      buildSyncQuery({ table: "boats", op: "PATCH", id: "b1", data: { not_a_real_column: 1 } });
    } catch (error) {
      expect((error as SyncWriteError).code).toBe("42703");
    }
  });
});
