// Logique de création d'une company + son compte owner, partagée entre
// scripts/seed-owner.ts (CLI, fallback ops) et POST /api/admin/companies
// (panneau admin SaaS). Une seule implémentation évite que les deux finissent
// par diverger (c'était déjà un risque latent avant cette extraction).
//
// Le paramètre `db` doit être une connexion Postgres UNIQUE (pas un Pool) :
// un `pg.Client` (CLI) ou un `PoolClient` obtenu via `pool.connect()` (route
// admin) — jamais `pool.query()` directement, qui répartirait BEGIN/INSERT/
// COMMIT sur des connexions différentes du pool et casserait la transaction.
import { randomUUID } from "node:crypto";
import { hashLoginCode } from "@/lib/auth/passwords";
import { isValidLoginCode, isValidMauritanianPhone } from "@/lib/auth/phoneAuth";
import { DuplicatePhoneError, ValidationError } from "./errors";

export interface QueryableClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface CreateCompanyInput {
  companyName: string;
  ownerName: string;
  phone: string;
  code: string;
}

export interface CreateCompanyResult {
  companyId: string;
  ownerId: string;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "وقود", // Carburant
  "طعام", // Nourriture
  "ماء", // Eau
  "ثلج", // Glace
  "معدات الصيد", // Équipement de pêche
  "إصلاحات", // Réparations
  "رسوم الميناء", // Frais de port
  "سلفة الطاقم", // Avance équipage
  "أخرى", // Autre
];

const POSTGRES_UNIQUE_VIOLATION = "23505";

export async function createCompany(
  db: QueryableClient,
  input: CreateCompanyInput,
): Promise<CreateCompanyResult> {
  const companyName = input.companyName.trim();
  const ownerName = input.ownerName.trim();

  if (!companyName) {
    throw new ValidationError("Le nom de la société est requis.");
  }
  if (!ownerName) {
    throw new ValidationError("Le nom du propriétaire est requis.");
  }
  if (!isValidMauritanianPhone(input.phone)) {
    throw new ValidationError(
      "Le téléphone doit être un numéro mauritanien à 8 chiffres commençant par 2, 3 ou 4.",
    );
  }
  if (!isValidLoginCode(input.code)) {
    throw new ValidationError("Le code doit être composé d'exactement 4 chiffres.");
  }

  const companyId = randomUUID();
  const ownerId = randomUUID();
  const codeHash = await hashLoginCode(input.code);

  try {
    await db.query("BEGIN");

    await db.query(`INSERT INTO companies (id, name, currency) VALUES ($1, $2, 'MRU')`, [
      companyId,
      companyName,
    ]);

    await db.query(
      `INSERT INTO users (id, company_id, name, phone, code_hash, role) VALUES ($1, $2, $3, $4, $5, 'owner')`,
      [ownerId, companyId, ownerName, input.phone, codeHash],
    );

    await db.query(
      `INSERT INTO settings (id, company_id, default_crew_payment_method, currency, language)
       VALUES ($1, $2, 'percentage_after_expenses', 'MRU', 'ar')`,
      [randomUUID(), companyId],
    );

    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
      await db.query(
        `INSERT INTO expense_categories (id, company_id, name, is_default) VALUES ($1, $2, $3, true)`,
        [randomUUID(), companyId, name],
      );
    }

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    if ((error as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new DuplicatePhoneError();
    }
    throw error;
  }

  return { companyId, ownerId };
}
