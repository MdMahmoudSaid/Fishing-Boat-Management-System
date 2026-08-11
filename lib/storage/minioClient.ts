// Remplace Supabase Storage. Même convention de chemin qu'avant
// ({company_id}/{expense_id}.jpg) pour ne rien changer côté
// lib/sync/photoUploadQueue.ts au-delà du transport.
import { Client } from "minio";
import { requireEnv } from "@/lib/env";

export const PHOTOS_BUCKET = process.env.MINIO_BUCKET ?? "expense-photos";

let client: Client | null = null;

export function getMinioClient(): Client {
  if (!client) {
    client = new Client({
      endPoint: requireEnv("MINIO_ENDPOINT"),
      port: Number(requireEnv("MINIO_PORT")),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: requireEnv("MINIO_ACCESS_KEY"),
      secretKey: requireEnv("MINIO_SECRET_KEY"),
    });
  }
  return client;
}

export function expensePhotoObjectPath(companyId: string, expenseId: string): string {
  return `${companyId}/${expenseId}.jpg`;
}
