import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // A package-lock.json in the user's home directory (outside this repo)
  // otherwise gets picked up as the inferred workspace root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
