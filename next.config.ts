import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function buildCsp(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let supabaseOrigin = "";
  if (supabaseUrl) {
    try {
      supabaseOrigin = new URL(supabaseUrl).origin;
    } catch {
      supabaseOrigin = "";
    }
  }

  const connectSources = [
    "'self'",
    "https://graph.microsoft.com",
    "https://login.microsoftonline.com",
    "https://accounts.google.com",
    "https://oauth2.googleapis.com",
    "https://www.googleapis.com",
    supabaseOrigin
  ].filter(Boolean);

  if (supabaseOrigin.startsWith("https://")) {
    connectSources.push(`wss://${supabaseOrigin.slice("https://".length)}`);
  }

  if (process.env.NODE_ENV !== "production") {
    connectSources.push("http://localhost:3000", "ws://localhost:3000");
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self' https://login.microsoftonline.com https://accounts.google.com"
  ];

  return directives.join("; ");
}

const nextConfig: NextConfig = {
  typedRoutes: true,
  productionBrowserSourceMaps: false,
  env: {
    // Exposed to the client for "what build am I on?" debugging.
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "",
    NEXT_PUBLIC_BUILD_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString()
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }
        ]
      },
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

const sentryWebpackPluginEnabled = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  tunnelRoute: process.env.SENTRY_TUNNEL_ROUTE ?? "/monitoring",
  widenClientFileUpload: true,
  telemetry: false,
  webpack: {
    treeshake: {
      removeDebugLogging: true
    }
  },
  sourcemaps: {
    disable: !sentryWebpackPluginEnabled
  }
});
