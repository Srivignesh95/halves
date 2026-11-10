import type { MetadataRoute } from "next";

// Lets phones install Halves to the home screen and open it full screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Halves",
    short_name: "Halves",
    description: "Split bills with friends and groups.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#5032c8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
