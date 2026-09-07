import "dotenv/config";
import { parseEther, formatEther } from "viem";
import { AgenticID } from "@0gfoundation/0g-agenticid-sdk";
import { appendFileSync } from "node:fs";

// Deploys "Beagle" as a sealed agent (ERC-7857 identity + TEE runtime) through the workshop attestor.
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0"; // attestor uses an sslip.io cert
const ATTESTOR = process.env.AGENTIC_ATTESTOR_URL;
const ag = await AgenticID.fromAttestor(ATTESTOR, { account: process.env.DEPLOYER_KEY });
const owner = ag.account?.address ?? (await ag.getAddress?.());
console.log("attestor", ATTESTOR, "owner", owner);

// 1. trust-root ack (once)
const st = await ag.ackStatus(owner);
console.log("ack status", st);
if (!st.allAcked) {
  const tx = await ag.ack();
  if (tx) { console.log("ack tx", tx); await ag.waitForTransaction(tx); }
}

// 2. prepaid sandbox balance (>= 0.1 OG)
let bal = await ag.getBalance();
console.log("sandbox balance", formatEther(bal), "OG");
if (bal < parseEther("0.1")) {
  const tx = await ag.deposit({ amountWei: parseEther("0.3") });
  console.log("deposit tx", tx); await ag.waitForTransaction(tx);
  bal = await ag.getBalance(); console.log("sandbox balance now", formatEther(bal), "OG");
}

// 3. deploy
try { console.log("models:", (await ag.agent.listModels()).slice(0, 8).join(", "), "…"); } catch (e) { console.log("listModels failed:", e.message); }
const params = {
  name: process.env.AGENT_NAME || "Beagle",
  description: "Pinky Promise worker agent: does research jobs and every reply is sealed with X-Agent-Proof so an escrow can pay on proof.",
  framework: process.env.AGENT_FRAMEWORK || "openclaw",
  inference: { provider: "0g-compute", model: process.env.MODEL || "0gm-1.0-35b-a3b" },
  sandbox: { apiKey: process.env.ROUTER_MAINNET_KEY },
};
console.log("deploying", params.name, params.framework, params.inference.model);
const dep = await ag.agent.deploy(params, { wait: "minted" });
console.log("minted:", dep);
appendFileSync(".env", `\nSEALED_AGENT_ID=${dep.agentId}\nSEALED_SEAL_ID=${dep.sealId}\nSEALED_AGENT_SEAL=${dep.agentSealAddr}\n`);

// 4. wait for the container
for (let i = 0; i < 60; i++) {
  const rows = await ag.agent.listDeployments();
  const me = rows.find((r) => String(r.sealId).toLowerCase() === String(dep.sealId).toLowerCase() || String(r.agentId) === String(dep.agentId));
  console.log(new Date().toISOString(), "phase", me?.phase, me?.url ?? "", me?.lastProvisionError ?? "");
  if (me?.phase === "running" && me.url) { appendFileSync(".env", `SEALED_AGENT_URL=${me.url}\n`); console.log("RUNNING at", me.url); process.exit(0); }
  if (me?.phase === "failed") { console.error("FAILED:", me.lastProvisionError); process.exit(2); }
  await new Promise((r) => setTimeout(r, 10000));
}
console.error("timeout waiting for running"); process.exit(3);
