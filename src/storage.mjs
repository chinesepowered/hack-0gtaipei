import "dotenv/config";
import { ethers } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";

/**
 * 0G Storage receipt archive. After a settlement, the receipt bundle
 * (task, reply, X-Agent-Proof or key receipt, job id, settlement tx) is
 * uploaded as an immutable file. The root hash is the durable pointer:
 * anyone can fetch the bundle back from the network and re-verify it
 * without our server.
 */
const RPC = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER = process.env.STORAGE_INDEXER || "https://indexer-storage-testnet-turbo.0g.ai";
export const storageScan = (root) => `https://storagescan-galileo.0g.ai/file/${root}`;

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
const indexer = new Indexer(INDEXER);

const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

export async function uploadReceipt(bundle) {
  return quiet(() => uploadReceiptLoud(bundle));
}
async function uploadReceiptLoud(bundle) {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle, null, 2));
  const data = new MemData(bytes);
  const [tree, terr] = await data.merkleTree();
  if (terr) throw new Error("merkle: " + terr);
  const rootHash = tree.rootHash();
  const t0 = Date.now();
  const [res, err] = await indexer.upload(data, RPC, signer);
  if (err) throw new Error("upload: " + (err.message || err));
  return { rootHash: res?.rootHash || rootHash, txHash: res?.txHash, bytes: bytes.length, ms: Date.now() - t0, url: storageScan(res?.rootHash || rootHash) };
}

export async function fetchReceipt(rootHash) {
  const [blob, err] = await quiet(() => indexer.downloadToBlob(rootHash, { proof: true }));
  if (err) throw new Error("download: " + (err.message || err));
  const text = Buffer.from(await blob.arrayBuffer()).toString("utf8");
  return JSON.parse(text);
}
