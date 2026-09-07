import "dotenv/config";
import { createPublicClient, createWalletClient, http, defineChain, parseGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: [process.env.RPC_URL || "https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "Chainscan", url: "https://chainscan-galileo.0g.ai" } },
});

export const publicClient = createPublicClient({ chain: galileo, transport: http() });

export function wallet(key) {
  const account = privateKeyToAccount(key);
  return { account, client: createWalletClient({ account, chain: galileo, transport: http() }) };
}

// 0G testnet requires priority fee >= 2 gwei
export const feeOpts = { maxPriorityFeePerGas: parseGwei("2"), maxFeePerGas: parseGwei("20") };

export function escrowArtifact() {
  return JSON.parse(readFileSync(new URL("../out/ProofEscrow.json", import.meta.url), "utf8"));
}

export const explorerTx = (h) => `https://chainscan-galileo.0g.ai/tx/${h}`;
export const explorerAddr = (a) => `https://chainscan-galileo.0g.ai/address/${a}`;

// Galileo sometimes answers "receipt not found" for a few seconds after a tx is accepted.
export async function waitReceipt(hash, { tries = 40, delayMs = 1500 } = {}) {
  for (let i = 0; i < tries; i++) {
    try { return await publicClient.getTransactionReceipt({ hash }); }
    catch { await new Promise((r) => setTimeout(r, delayMs)); }
  }
  throw new Error(`receipt not found for ${hash}`);
}
