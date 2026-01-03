import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia, polygon, arbitrum } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "NewsArb",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [mainnet, sepolia, polygon, arbitrum],
  ssr: true,
});
