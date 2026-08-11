import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Le moteur SQLite (WASM) de PowerSync pèse ~2.5MB : au-delà de la limite
  // par défaut (2MB), il ne serait pas pré-caché, ce qui casserait le
  // lancement 100% hors-ligne à froid exigé par le PROJECT_PLAN (§8).
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image Docker de production allégée (.next/standalone) : ne copie que les
  // fichiers réellement nécessaires à l'exécution, pas node_modules entier —
  // voir Dockerfile.
  output: "standalone",
};

export default withSerwist(nextConfig);
