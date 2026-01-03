import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@newsarb/shared"],
  output: "standalone",
};

export default nextConfig;
