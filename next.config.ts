import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  env: {
    // Exposed to the client for "what build am I on?" debugging.
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString()
  },
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" }
        ]
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }]
      }
    ];
  }
};

export default nextConfig;
