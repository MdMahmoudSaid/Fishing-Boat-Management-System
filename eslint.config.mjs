import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// eslint-config-next 16+ ships native flat config arrays — plus besoin de
// FlatCompat (qui provoquait une erreur "circular structure" avec cette
// version, incompatible avec l'ancien pont eslintrc).
const eslintConfig = [...nextCoreWebVitals];

export default eslintConfig;
