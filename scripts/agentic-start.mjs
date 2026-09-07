import "dotenv/config";
import { parseEther, formatEther } from "viem";
import { AgenticID } from "@0gfoundation/0g-agenticid-sdk";
import { readFileSync, writeFileSync } from "node:fs";

// Brings the sealed Beagle back online after its container stopped (billing, reap, or owner stop),
// tops up the prepaid sandbox balance if it is low, and records the new URL in .env.
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
const ag = await AgenticID.fromAttestor(process.env.AGENTIC_ATTESTOR_URL, { account: process.env.DEPLOYER_KEY });
const sealId = process.env.SEALED_SEAL_ID, agentId = BigInt(process.env.SEALED_AGENT_ID);
const apiKey = process.env.ROUTER_MAINNET_KEY;

let bal = await ag.getBalance();
console.log("sandbox balance", formatEther(bal), "OG");
if (bal < parseEther("0.2")) {
  const tx = await ag.deposit({ amountWei: parseEther(process.env.SANDBOX_TOPUP || "0.5") });
  console.log("deposit tx", tx); await ag.waitForTransaction(tx);
  bal = await ag.getBalance(); console.log("sandbox balance now", formatEther(bal), "OG");
}

const mine = await ag.agent.listMyDeployments();
const me = mine.find((r) => String(r.agentId) === String(agentId) || String(r.sealId).toLowerCase() === sealId.toLowerCase());
console.log("current:", me ? { phase: me.phase, sandboxId: me.sandboxId, url: me.url, err: me.lastProvisionError } : "not listed");

if (me?.phase === "running" && me.url) { console.log("already running at", me.url); save(me.url); process.exit(0); }

async function tryStart() {
  if (me?.phase === "stopped" && me.sandboxId) {
    try { console.log("start(sealId, sandboxId)…"); await ag.agent.start(sealId, me.sandboxId); return "start"; }
    catch (e) { console.log("start with sandboxId failed:", e.message?.slice(0, 200)); }
  }
  try { console.log("start(sealId, { apiKey })…"); await ag.agent.start(sealId, { apiKey }); return "provision"; }
  catch (e) { console.log("fresh provision failed:", e.message?.slice(0, 200)); }
  console.log("reset(sealId, { framework, apiKey })…");
  await ag.agent.reset(sealId, { framework: process.env.AGENT_FRAMEWORK || "openclaw", apiKey });
  return "reset";
}
console.log("action:", await tryStart());

for (let i = 0; i < 60; i++) {
  const rows = await ag.agent.listDeployments();
  const r = rows.find((x) => String(x.agentId) === String(agentId));
  console.log(new Date().toISOString(), "phase", r?.phase, r?.url ?? "", r?.lastProvisionError ?? "");
  if (r?.phase === "running" && r.url) { save(r.url); console.log("RUNNING at", r.url); process.exit(0); }
  if (r?.phase === "failed") { console.error("FAILED:", r.lastProvisionError); process.exit(2); }
  await new Promise((res) => setTimeout(res, 10000));
}
console.error("timeout"); process.exit(3);

function save(url) {
  const env = readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => !l.startsWith("SEALED_AGENT_URL=")).join("\n").trimEnd();
  writeFileSync(".env", env + `\nSEALED_AGENT_URL=${url}\n`);
}
