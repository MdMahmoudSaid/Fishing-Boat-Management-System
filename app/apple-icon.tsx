import { ImageResponse } from "next/og";

// iOS Safari ne prend pas en charge les icônes SVG pour "Ajouter à l'écran
// d'accueil" — sans ce fichier, l'app installée sur iPhone/iPad afficherait
// une capture de la page au lieu de l'icône. Pas de border-radius : iOS
// applique son propre masque d'arrondi.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          fontSize: 110,
        }}
      >
        🎣
      </div>
    ),
    { ...size },
  );
}
