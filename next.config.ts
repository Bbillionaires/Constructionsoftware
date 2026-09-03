import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Local dev/demo uploads live under /public/uploads; a couple of seeded
    // demo photos are SVG placeholders. Real technician photo uploads are
    // JPEG/PNG from phone cameras, so this only affects our own seed assets.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
