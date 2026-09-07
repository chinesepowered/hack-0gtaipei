import "dotenv/config";
import http from "node:http";
import { readFileSync } from "node:fs";
import { parseEther, recoverMessageAddress, formatEther } from "viem";
import { publicClient, wallet, feeOpts, escrowArtifact, explorerTx, explorerAddr, waitReceipt } from "./chain.mjs";
import { workJob, agentAccount, hashText, receiptDigest } from "./agent.mjs";
import { MODEL, ROUTER_NET, ROUTER_BASE } from "./router.mjs";
import { sealedWork, sealedInfo, verifySeal } from "./sealed.mjs";
import { uploadReceipt, fetchReceipt, storageScan } from "./storage.mjs";

const PORT = Number(process.env.PORT || 3000);
const ESCROW = process.env.ESCROW_ADDRESS;
const { abi } = escrowArtifact();
const client = wallet(process.env.DEPLOYER_KEY); // demo "client" wallet that funds jobs and relays settlements

// receipt archive on 0G Storage: jobId -> { status, rootHash, txHash, url, error }
const archives = new Map();
function archive(jobId, bundle) {
  archives.set(String(jobId), { status: "uploading" });
  uploadReceipt(bundle)
    .then((r) => archives.set(String(jobId), { status: "done", ...r }))
    .catch((e) => { console.error("archive failed", e.message); archives.set(String(jobId), { status: "failed", error: e.message }); });
}
const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v))); };
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b ? JSON.parse(b) : {})); });
const revertReason = (e) => { const m = String(e.shortMessage || e.message); const r = m.match(/reason:\s*\n?([^\n]+)/); return r ? r[1].trim() : m; };

async function createJob(task, amount, mode) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const sealed = mode === "sealed";
  const info = sealed ? sealedInfo() : null;
  const agent = sealed ? info.agentSeal : agentAccount.address;      // payout address
  const agentId = sealed ? BigInt(info.agentId) : 0n;
  const hash = await client.client.writeContract({ address: ESCROW, abi, functionName: "createJob", args: [agent, agentId, hashText(task), deadline], value: parseEther(amount), ...feeOpts });
  const rcpt = await waitReceipt(hash);
  const id = await publicClient.readContract({ address: ESCROW, abi, functionName: "jobCount" });
  return { jobId: id.toString(), tx: hash, txUrl: explorerTx(hash), block: rcpt.blockNumber.toString(), mode: sealed ? "sealed" : "key", agent, agentId: agentId.toString() };
}

async function settle(receipt) {
  const hash = await client.client.writeContract({ address: ESCROW, abi, functionName: "settle", args: [BigInt(receipt.jobId), receipt.outputHash, receipt.proofHash, receipt.signature], ...feeOpts });
  const rcpt = await waitReceipt(hash);
  return { tx: hash, txUrl: explorerTx(hash), status: rcpt.status };
}

async function settleWithSeal(jobId, outputHash, proof) {
  const p = { agentId: BigInt(proof.agentId), submitter: proof.submitter, timestamp: BigInt(proof.timestamp), deadline: BigInt(proof.deadline), taskHash: proof.taskHash, dataHashes: proof.dataHashes, frameworkHash: proof.frameworkHash, signature: proof.signature };
  const hash = await client.client.writeContract({ address: ESCROW, abi, functionName: "settleWithSeal", args: [BigInt(jobId), outputHash, p], ...feeOpts });
  const rcpt = await waitReceipt(hash);
  return { tx: hash, txUrl: explorerTx(hash), status: rcpt.status };
}

async function readJob(id) {
  const j = await publicClient.readContract({ address: ESCROW, abi, functionName: "jobs", args: [BigInt(id)] });
  return { client: j[0], agent: j[1], agentId: j[2].toString(), taskHash: j[3], amount: formatEther(j[4]), deadline: j[5].toString(), settled: j[6], refunded: j[7], outputHash: j[8], proofHash: j[9] };
}

async function verifyReceipt(receipt, output) {
  const reasons = [];
  const outputMatches = hashText(output || "") === receipt.outputHash;
  if (!outputMatches) reasons.push("output text does not match the hash in the receipt");
  const digest = receiptDigest(receipt);
  const digestMatches = digest === receipt.digest;
  if (!digestMatches) reasons.push("receipt fields do not reproduce the signed digest");
  let signer = null;
  try { signer = await recoverMessageAddress({ message: { raw: digest }, signature: receipt.signature }); } catch { reasons.push("signature malformed"); }
  const signerMatches = signer?.toLowerCase() === receipt.agent.toLowerCase();
  if (!signerMatches) reasons.push("signature was not made by the agent's identity key");
  let onChain = null;
  try { onChain = await readJob(receipt.jobId); if (onChain.agent.toLowerCase() !== receipt.agent.toLowerCase()) reasons.push("on-chain job names a different agent"); }
  catch { reasons.push("job not found on chain"); }
  return { ok: reasons.length === 0, outputMatches, digestMatches, signerMatches, signer, onChain, reasons };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(readFileSync(new URL("../web/index.html", import.meta.url))); }
    if (req.method === "GET" && (url.pathname === "/slides" || url.pathname === "/slides.html")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(readFileSync(new URL("../web/slides.html", import.meta.url))); }
    if (req.method === "GET" && (url.pathname === "/slides_cn" || url.pathname === "/slides_cn.html")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(readFileSync(new URL("../web/slides_cn.html", import.meta.url))); }
    if (req.method === "GET" && /^\/[a-z0-9_-]+\.(js|html|css|png|svg)$/i.test(url.pathname)) { try { const body = readFileSync(new URL("../web" + url.pathname, import.meta.url)); const ct = { js: "application/javascript", html: "text/html", css: "text/css", png: "image/png", svg: "image/svg+xml" }[url.pathname.split(".").pop().toLowerCase()]; res.writeHead(200, { "Content-Type": ct }); return res.end(body); } catch {} }
    if (req.method === "GET" && url.pathname === "/api/info") {
      const s = sealedInfo();
      const [clientBal, agentBal, sealBal] = await Promise.all([
        publicClient.getBalance({ address: client.account.address }),
        publicClient.getBalance({ address: agentAccount.address }),
        s ? publicClient.getBalance({ address: s.agentSeal }) : Promise.resolve(0n),
      ]);
      return json(res, 200, { escrow: ESCROW, escrowUrl: explorerAddr(ESCROW), client: client.account.address, agent: agentAccount.address, agentUrl: explorerAddr(agentAccount.address), clientBalance: formatEther(clientBal), agentBalance: formatEther(agentBal), chainId: 16602, router: { net: ROUTER_NET, base: ROUTER_BASE, model: MODEL }, sealed: s ? { ...s, sealBalance: formatEther(sealBal), sealUrl: explorerAddr(s.agentSeal) } : null });
    }
    if (req.method === "POST" && url.pathname === "/api/job") { const { task, amount = "0.01", mode = "key" } = await readBody(req); return json(res, 200, await createJob(task, amount, mode)); }
    if (req.method === "POST" && url.pathname === "/api/work") {
      const { jobId, task, mode = "key" } = await readBody(req);
      if (mode === "sealed") return json(res, 200, await sealedWork({ jobId, task, clientAddress: client.account.address }));
      return json(res, 200, await workJob({ jobId, task, escrow: ESCROW }));
    }
    if (req.method === "POST" && url.pathname === "/api/settle") {
      const { receipt, mode = "key", jobId, outputHash, proof, task, output, exchange, trace } = await readBody(req);
      try {
        const r = mode === "sealed" ? await settleWithSeal(jobId, outputHash, proof) : await settle(receipt);
        if (r.status === "success") {
          const id = mode === "sealed" ? jobId : receipt.jobId;
          archive(id, { kind: "pinky-promise-receipt", version: 1, chainId: 16602, escrow: ESCROW, jobId: String(id), mode, task: task ?? null, output: output ?? null, exchange: exchange ?? null,
            ...(mode === "sealed" ? { proof, agenticId: process.env.AGENTIC_ID_ADDRESS } : { receipt, trace: trace ?? null }), settlementTx: r.tx, archivedAt: new Date().toISOString() });
          r.archive = { status: "uploading" };
        }
        return json(res, 200, r);
      }
      catch (e) { return json(res, 200, { status: "reverted", error: revertReason(e) }); }
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/archive/")) return json(res, 200, archives.get(url.pathname.split("/").pop()) || { status: "none" });
    if (req.method === "POST" && url.pathname === "/api/fetch-receipt") {
      const { rootHash } = await readBody(req);
      const t0 = Date.now();
      const bundle = await fetchReceipt(rootHash);
      let verification = null;
      if (bundle.mode === "sealed") {
        const onchainSeal = await publicClient.readContract({ address: bundle.agenticId || process.env.AGENTIC_ID_ADDRESS, abi: [{ type: "function", name: "getAgentSeal", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] }], functionName: "getAgentSeal", args: [BigInt(bundle.proof.agentId)] });
        verification = await verifySeal({ proof: bundle.proof, output: bundle.output, exchange: bundle.exchange, expectedSeal: onchainSeal });
      } else if (bundle.receipt) {
        verification = await verifyReceipt(bundle.receipt, bundle.output);
      }
      let onChain = null; try { onChain = await readJob(bundle.jobId); } catch {}
      return json(res, 200, { rootHash, url: storageScan(rootHash), fetchMs: Date.now() - t0, bundle, verification, onChain });
    }
    if (req.method === "POST" && url.pathname === "/api/verify") {
      const { mode = "key", receipt, output, proof, exchange, jobId } = await readBody(req);
      if (mode === "sealed") {
        const onchainSeal = await publicClient.readContract({ address: process.env.AGENTIC_ID_ADDRESS, abi: [{ type: "function", name: "getAgentSeal", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] }], functionName: "getAgentSeal", args: [BigInt(proof.agentId)] });
        const v = await verifySeal({ proof, output, exchange, expectedSeal: onchainSeal });
        let onChain = null; try { onChain = await readJob(jobId); } catch {}
        return json(res, 200, { ...v, onChain });
      }
      return json(res, 200, await verifyReceipt(receipt, output));
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/job/")) return json(res, 200, await readJob(url.pathname.split("/").pop()));
    json(res, 404, { error: "not found" });
  } catch (e) { console.error(e); json(res, 500, { error: String(e.shortMessage || e.message) }); }
});
server.listen(PORT, () => console.log(`Pinky Promise -> http://localhost:${PORT}  escrow=${ESCROW}  sealed=${sealedInfo()?.agentId ?? "none"}`));
