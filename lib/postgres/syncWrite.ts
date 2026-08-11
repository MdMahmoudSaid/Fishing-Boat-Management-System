// Construit les requêtes SQL paramétrées qui remplacent
// supabase.from(table).upsert()/.update()/.delete() (API PostgREST). Table
// et colonnes vérifiées contre un allowlist fixe (dérivé du schéma dans
// db/migrations/20260804000000_init_schema.sql) : les identifiants SQL ne
// sont jamais interpolés à partir d'une valeur non validée, ce qui exclut
// toute injection même si `data` vient du client (via PowerSync).
export class SyncWriteError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const TABLE_COLUMNS: Record<string, ReadonlySet<string>> = {
  boats: new Set([
    "id", "company_id", "name", "registration_number", "captain_name",
    "notes", "status", "created_at", "updated_at", "deleted_at",
  ]),
  crew_members: new Set(["id", "company_id", "name", "phone", "notes", "created_at", "deleted_at"]),
  fish_categories: new Set(["id", "company_id", "name", "default_unit", "notes", "created_at", "deleted_at"]),
  fish_quality_levels: new Set([
    "id", "company_id", "fish_category_id", "name", "default_price", "created_at", "deleted_at",
  ]),
  expense_categories: new Set(["id", "company_id", "name", "is_default", "created_at", "deleted_at"]),
  buyers: new Set(["id", "company_id", "name", "phone", "notes", "created_at", "deleted_at"]),
  trips: new Set([
    "id", "company_id", "boat_id", "captain_name", "departure_date",
    "expected_return_date", "actual_return_date", "status",
    "crew_payment_method", "notes", "created_at", "updated_at", "deleted_at",
  ]),
  trip_crew: new Set([
    "id", "company_id", "trip_id", "crew_member_id", "payment_type",
    "fixed_amount", "percentage", "computed_amount",
  ]),
  expenses: new Set([
    "id", "company_id", "trip_id", "expense_category_id", "amount", "date",
    "description", "photo_url", "photo_local_status", "created_at",
  ]),
  catches: new Set([
    "id", "company_id", "trip_id", "fish_category_id", "fish_quality_level_id",
    "quantity", "unit", "estimated_price", "created_at",
  ]),
  sales: new Set([
    "id", "company_id", "trip_id", "buyer_id", "fish_category_id",
    "fish_quality_level_id", "quantity", "sale_price", "total_amount", "date", "created_at",
  ]),
  sale_payments: new Set(["id", "company_id", "sale_id", "amount", "date", "notes", "created_at"]),
  settings: new Set(["id", "company_id", "default_crew_payment_method", "currency", "language"]),
};

export function assertSyncableTable(table: string): void {
  if (!TABLE_COLUMNS[table]) {
    throw new SyncWriteError("42P01", `Table non autorisée pour la synchro : "${table}"`);
  }
}

export interface SyncOperation {
  table: string;
  op: "PUT" | "PATCH" | "DELETE";
  id: string;
  data?: Record<string, unknown>;
}

export interface SyncQuery {
  text: string;
  values: unknown[];
}

export function buildSyncQuery(operation: SyncOperation): SyncQuery {
  const { table, op, id, data } = operation;
  const allowedColumns = TABLE_COLUMNS[table];
  if (!allowedColumns) {
    throw new SyncWriteError("42P01", `Table non autorisée pour la synchro : "${table}"`);
  }

  if (op === "DELETE") {
    return { text: `DELETE FROM ${table} WHERE id = $1`, values: [id] };
  }

  const record: Record<string, unknown> = { ...(data ?? {}), id };
  for (const column of Object.keys(record)) {
    if (!allowedColumns.has(column)) {
      throw new SyncWriteError("42703", `Colonne non autorisée sur "${table}" : "${column}"`);
    }
  }

  const columns = Object.keys(record);
  const values = columns.map((column) => record[column]);

  if (op === "PUT") {
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const updates = columns
      .filter((column) => column !== "id")
      .map((column) => `${column} = excluded.${column}`)
      .join(", ");
    return {
      text: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (id) DO UPDATE SET ${updates}`,
      values,
    };
  }

  // PATCH
  const patchColumns = columns.filter((column) => column !== "id");
  const setClauses = patchColumns.map((column, index) => `${column} = $${index + 1}`);
  const patchValues = patchColumns.map((column) => record[column]);
  return {
    text: `UPDATE ${table} SET ${setClauses.join(", ")} WHERE id = $${patchValues.length + 1}`,
    values: [...patchValues, id],
  };
}
