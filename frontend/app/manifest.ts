import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yo",
    short_name: "Yo",
    description: "Yo",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait",
    icons: [
      {
        src: "/app-icon-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
