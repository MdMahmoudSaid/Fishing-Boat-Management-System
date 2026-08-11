// Crée le bucket privé pour les photos de dépenses si absent — à exécuter
// une fois après le premier `docker compose up` (local ou VPS). Remplace
// la migration SQL `storage.buckets` de Supabase.
//
// Usage : npm run init-storage

import { getMinioClient, PHOTOS_BUCKET } from "../lib/storage/minioClient";

async function main() {
  const client = getMinioClient();
  const exists = await client.bucketExists(PHOTOS_BUCKET).catch(() => false);
  if (exists) {
    console.log(`Bucket "${PHOTOS_BUCKET}" déjà présent.`);
    return;
  }
  await client.makeBucket(PHOTOS_BUCKET);
  console.log(`✅ Bucket "${PHOTOS_BUCKET}" créé.`);
}

main().catch((error) => {
  console.error("❌ Échec de l'initialisation MinIO :", error.message ?? error);
  process.exit(1);
});
