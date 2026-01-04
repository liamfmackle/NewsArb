import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@newsarb/shared"],
  output: "standalone",
  webpack: (config) => {
    config.externals.push("pino-pretty", "encoding");
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
