import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.35.197.85'],
  turbopack: {
    root: path.resolve(__dirname),
  },

  /* config options here */
  // reactCompiler runs via a Babel plugin on this Next version (16.2.10) — no
  // Rust port yet. It was pinning dev-server CPU (~62%) and thrashing disk on
  // every HMR recompile. Disabled to restore normal dev perf. Re-enable once on
  // Next 16.3+ with `experimental.turbopackRustReactCompiler: true`.
  // reactCompiler: true,
};

export default nextConfig;
