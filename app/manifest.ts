import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RR Creative Interiors",
    short_name: "RR Interiors",
    description: "Beyond The Ordinary — interior design studio in Bangalore.",
    start_url: "/",
    display: "standalone",
    background_color: "#110c0a",
    theme_color: "#110c0a",
    icons: [
      {
        src: "/rr-media/logo/Glossy%20Red%20and%20Gold%20Split%20Emblem.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
