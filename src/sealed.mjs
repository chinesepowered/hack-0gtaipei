import "dotenv/config";
import { keccak256, toBytes, recoverMessageAddress } from "viem";

/**
 * Talks to the sealed Beagle (0G Agentic ID, ERC-7857) running inside a TEE sandbox.
 * Every response from its /api/* surface (and /hello) carries an X-Agent-Proof header:
 *   X-Agent-Proof: 0x<65-byte sig>.<base64url envelope JSON>
 * The envelope is the ServeProof (agent_id, submitter, timestamp, deadline, task_hash,
 * data_hashes, framework_hash) signed by the AgentSeal key that never leaves the TEE.
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

export function sealedInfo() {
  const { SEALED_AGENT_ID, SEALED_AGENT_SEAL, SEALED_AGENT_URL, SEALED_SEAL_ID } = process.env;
  if (!SEALED_AGENT_ID || !SEALED_AGENT_SEAL) return null;
  return { agentId: SEALED_AGENT_ID, agentSeal: SEALED_AGENT_SEAL, url: SEALED_AGENT_URL || null, sealId: SEALED_SEAL_ID || null, attestor: process.env.AGENTIC_ATTESTOR_URL };
}

export function parseAgentProof(header) {
  if (!header) return null;
  const dot = header.indexOf(".");
  const signature = header.slice(0, dot);
  const b64 = header.slice(dot + 1).replace(/-/g, "+").replace(/_/g, "/");
  const env = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const pick = (a, b) => env[a] ?? env[b];
  return {
    agentId: String(pick("agent_id", "agentId")),
    submitter: pick("submitter", "submitter"),
    timestamp: String(pick("timestamp", "timestamp")),
    deadline: String(pick("deadline", "deadline")),
    taskHash: pick("task_hash", "taskHash"),
    dataHashes: pick("data_hashes", "dataHashes") || [],
    frameworkHash: pick("framework_hash", "frameworkHash"),
    signature,
    raw: env,
  };
}

/** Fetch a sealed endpoint and capture the stamp. */
export async function fetchWithProof(path, { method = "GET", body, clientAddress } = {}) {
  const info = sealedInfo();
  if (!info?.url) throw new Error("sealed agent has no URL yet");
  const res = await fetch(info.url.replace(/\/$/, "") + path, {
    method,
    headers: { "content-type": "application/json", ...(clientAddress ? { "X-Client-Address": clientAddress } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const header = res.headers.get("x-agent-proof");
  if (!header) {
    let msg = text.slice(0, 200); try { msg = JSON.parse(text).message || msg; } catch {}
    throw new Error(`sealed agent answered ${res.status} without X-Agent-Proof: ${msg}`);
  }
  return { status: res.status, text, proof: parseAgentProof(header), rawHeader: header };
}

/** Ask the sealed Beagle to do a job. Tries its registered /api/* services, else /hello as a proof-of-life stamp. */
export async function sealedWork({ jobId, task, clientAddress }) {
  const info = sealedInfo();
  const hello = await fetchWithProof("/hello", { clientAddress });
  let card = null; try { card = JSON.parse(hello.text); } catch {}
  const services = card?.services || [];
  let result = null;
  for (const s of services) {
    if (!/^\/api\//.test(s.path)) continue;
    try {
      const reqBody = { task, q: task, input: task, jobId };
      const r = await fetchWithProof(s.path, { method: s.method || "POST", body: reqBody, clientAddress });
      if (r.proof) { result = { ...r, service: s.path, exchange: { method: s.method || "POST", uri: s.path, reqBody: JSON.stringify(reqBody), status: r.status } }; break; }
    } catch (e) { /* try next */ }
  }
  if (!result) result = { ...hello, service: "/hello", exchange: { method: "GET", uri: "/hello", reqBody: "", status: hello.status } };
  const outputHash = keccak256(toBytes(result.text));
  let answer = result.text, answerError = null; try { const j = JSON.parse(result.text); if (j.answer) answer = j.answer; else if (j.error) { answerError = String(j.error); answer = '(sealed service returned an error: ' + answerError + ')'; } } catch {}
  let modelTrace = null; try { const j = JSON.parse(result.text); if (j.model || j.provider) modelTrace = { model: j.model, provider: j.provider, teeVerified: j.tee_verified }; } catch {}
  const proof = result.proof;
  let signer = null;
  if (proof) {
    // Recreate the ServeProof digest to show who signed (contract does the same on chain)
    const { buildServeProofMessageHash } = await import("@0gfoundation/0g-agenticid-sdk");
    const digest = buildServeProofMessageHash({
      chainId: 16602n, verifyingContract: process.env.AGENTIC_ID_ADDRESS, submitter: proof.submitter, agentId: BigInt(proof.agentId),
      timestamp: BigInt(proof.timestamp), deadline: BigInt(proof.deadline), taskHash: proof.taskHash, dataHashes: proof.dataHashes, frameworkHash: proof.frameworkHash,
    });
    try { signer = await recoverMessageAddress({ message: { raw: digest }, signature: proof.signature }); } catch {}
  }
  return { mode: "sealed", jobId, service: result.service, status: result.status, exchange: result.exchange, output: result.text, answer, answerError, modelTrace, outputHash, proof, rawHeader: result.rawHeader, signer, expectedSeal: info.agentSeal, sealMatches: signer?.toLowerCase() === info.agentSeal.toLowerCase(), services: services.map((s) => s.path), card };
}


/**
 * Offline check of an X-Agent-Proof, the same way the contract does it, plus the exchange binding.
 * task_hash = keccak256(method ‖ uri ‖ keccak256(reqBody) ‖ keccak256(body) ‖ status)  (sealed proxy)
 */
export async function verifySeal({ proof, output, exchange, expectedSeal, chainId = 16602 }) {
  const { keccak256: k, toBytes: tb, concat, stringToBytes } = await import("viem");
  const reasons = [];
  let exchangeMatches = null;
  if (exchange) {
    const rebuilt = k(concat([stringToBytes(exchange.method), stringToBytes(exchange.uri), tb(k(stringToBytes(exchange.reqBody || ""))), tb(k(stringToBytes(output || ""))), stringToBytes(String(exchange.status))]));
    exchangeMatches = rebuilt.toLowerCase() === String(proof.taskHash).toLowerCase();
    if (!exchangeMatches) reasons.push("the reply text does not match the exchange hash sealed by the agent");
  }
  const { buildServeProofMessageHash } = await import("@0gfoundation/0g-agenticid-sdk");
  const digest = buildServeProofMessageHash({ chainId: BigInt(chainId), verifyingContract: process.env.AGENTIC_ID_ADDRESS, submitter: proof.submitter, agentId: BigInt(proof.agentId), timestamp: BigInt(proof.timestamp), deadline: BigInt(proof.deadline), taskHash: proof.taskHash, dataHashes: proof.dataHashes, frameworkHash: proof.frameworkHash });
  let signer = null;
  try { signer = await recoverMessageAddress({ message: { raw: digest }, signature: proof.signature }); } catch { reasons.push("signature malformed"); }
  const signerMatches = !!signer && signer.toLowerCase() === String(expectedSeal).toLowerCase();
  if (!signerMatches) reasons.push("signer is not the AgentSeal registered on chain for this agent");
  const notExpired = Number(proof.deadline) > Math.floor(Date.now() / 1000);
  if (!notExpired) reasons.push("seal deadline has passed");
  return { ok: reasons.length === 0, exchangeMatches, signerMatches, notExpired, signer, expectedSeal, reasons };
}
