import "dotenv/config";
import { keccak256, toBytes, encodeAbiParameters, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verifiedChat } from "./router.mjs";

/**
 * The worker agent ("Beagle"). Holds its own identity key. For every job it:
 *  1. runs the task through 0G Compute with TEE verification,
 *  2. hashes task, output, and the TEE trace,
 *  3. signs a receipt binding all of them to the job id and the escrow contract.
 */
export const agentAccount = privateKeyToAccount(process.env.AGENT_KEY);

export const hashText = (s) => keccak256(toBytes(s));

export function proofHashOf(trace) {
  // Commit to the 0G TEE proof coordinates; the raw signature is fetched from the provider on demand.
  return keccak256(stringToHex(JSON.stringify({ provider: trace.provider, chatId: trace.chatId, requestId: trace.requestId, model: trace.model })));
}

export function receiptDigest({ chainId, escrow, jobId, taskHash, outputHash, proofHash }) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [BigInt(chainId), escrow, BigInt(jobId), taskHash, outputHash, proofHash],
    ),
  );
}

export async function workJob({ jobId, task, escrow, chainId = 16602 }) {
  const trace = await verifiedChat([
    { role: "system", content: "You are Beagle, a diligent research agent. Answer the task concisely and completely in under 200 words." },
    { role: "user", content: task },
  ]);
  const taskHash = hashText(task);
  const outputHash = hashText(trace.text);
  const proofHash = proofHashOf(trace);
  const digest = receiptDigest({ chainId, escrow, jobId, taskHash, outputHash, proofHash });
  const signature = await agentAccount.signMessage({ message: { raw: digest } });
  return {
    receipt: { jobId: String(jobId), escrow, chainId, agent: agentAccount.address, taskHash, outputHash, proofHash, digest, signature },
    output: trace.text,
    trace,
  };
}
