import { ImageResponse } from "next/og";

// Icône PWA/favicon générée au build, en plus du SVG statique dans
// public/icons/ — nécessaire car certains contextes (favicon d'onglet,
// raccourcis) préfèrent un PNG raster à un SVG.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 96,
          fontSize: 300,
        }}
      >
        🎣
      </div>
    ),
    { ...size },
  );
}
