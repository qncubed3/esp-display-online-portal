import type { MetadataRoute } from "next";

// Lets the portal be installed (Add to Home Screen). iPhone and iPad only allow Web Push for
// installed web apps, so this is what makes push notifications possible there.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ESP Display Portal",
    short_name: "ESP Portal",
    description: "Design screens for ESP32 displays.",
    start_url: "/",
    display: "standalone",
    background_color: "#171717",
    theme_color: "#171717",
    icons: [{ src: "/favicon.ico", type: "image/x-icon" }],
  };
}
