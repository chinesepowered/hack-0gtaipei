# Pinky Promise 🐶🤝🦫 — pay-on-proof escrow for AI agents on 0G

> Agents are becoming economic participants: they take jobs, charge, and hire other agents.
> When nobody is watching between hops, "I trust you" stops being a security model — **every hop needs a proof**.
> Pinky Promise is the settlement primitive for that world: a client locks a bounty, an agent does the work,
> and the escrow pays out **only** when a cryptographic proof of the service lands on chain.

Built at the 0G Taipei hackathon (2026-09-07). Track C (on-chain agent / DApp) with Track A + B inside it.

## What it does

| Step | Who | What happens | 0G piece |
|---|---|---|---|
| 1 | Client (Capybara's customer) | `createJob(agent, agentId, keccak(task), deadline)` with a bounty in 0G | 0G Galileo testnet |
| 2 | Worker agent (Beagle) | Runs the task through **0G Compute** with `verify_tee: true` → provider TEE signature, `tee_verified: true` | 0G Compute Router, model `0gm-1.0-35b-a3b` |
| 3 | Worker agent | Produces a **proof**: either a receipt signed by its own key, or a **sealed X-Agent-Proof** from its 0G Agentic ID | 0G Agentic ID (ERC-7857) |
| 4 | Escrow (Capybara) | Verifies the proof on chain and pays the agent. Forged proofs revert. Replayed seals revert. | `ProofEscrow.sol` |
| 5 | Anyone | Re-verifies the proof offline, no gas: signer, hashes, on-chain job | browser |

Two worker modes are demoed side by side:

* **Beagle (key-signed receipt)** — the agent holds an EOA and signs `keccak(chainId, escrow, jobId, taskHash, outputHash, proofHash)`, where `proofHash` commits to the 0G Compute TEE trace (`provider`, `chatID`, `request_id`, `model`). Anyone can fetch the provider's raw signature at `{providerUrl}/v1/proxy/signature/{chatID}` and check it.
* **Sealed Beagle (X-Agent-Proof)** — the agent is an **ERC-7857 Agentic ID (#383)** deployed through the 0G attestor into a TEE sandbox. Its `AgentSeal` key was derived inside the TEE and never leaves it; the owner cannot read it. Every response carries an `X-Agent-Proof` header (`<sig>.<base64 ServeProof>`) naming *who sealed it, which data/framework it ran, which exchange, and who may redeem it*. `ProofEscrow.settleWithSeal` rebuilds the **same digest the 0G ReputationRegistry uses**, `ecrecover`s it, and requires the signer to equal `AgenticID.getAgentSeal(agentId)` and the `submitter` to equal the job's client. One seal → one payout (replay-protected).

## Integration points (where 0G is actually called)

| File | Integration |
|---|---|
| `src/router.mjs` | 0G Compute Router: `POST https://router-api.0g.ai/v1/chat/completions` with `verify_tee: true` and `X-0G-Provider-Trust-Mode: verified`; reads `x_0g_trace.provider`, `tee_verified`, `ZG-Res-Key` |
| `src/agent.mjs` | Worker agent: hashes task/output/TEE trace and signs the escrow receipt |
| `scripts/agentic-deploy.mjs` | 0G Agentic ID SDK (`@0gfoundation/0g-agenticid-sdk`): trust-root `ack()`, sandbox `deposit()`, `agent.deploy({ framework: "openclaw", inference: { provider: "0g-compute", model: "0gm-1.0-35b-a3b" } })` → mints ERC-7857 #383 and provisions the TEE container |
| `src/sealed.mjs` | Calls the sealed agent with `X-Client-Address`, parses `X-Agent-Proof`, recovers the signer with the SDK's `buildServeProofMessageHash` |
| `contracts/ProofEscrow.sol` | On-chain verification of both proof types; `settleWithSeal` reads `getAgentSeal()` from the AgenticID contract (`0x5BB5…B24A`, Galileo) |

## Deployed (0G Galileo, chain id 16602)

| Thing | Address / id |
|---|---|
| ProofEscrow | `0xac8faab5e74824fb24701e4ef2733754854efb95` |
| Sealed Beagle — Agentic ID | `#383` on AgenticID `0x5BB50987521A3fb7Da6Cd6aCC0ad1061D975B24A` |
| Sealed Beagle — AgentSeal (payout) | `0x9891fa22308e1dc4570a9df51af89f4b1c092c0b` |
| Sealed Beagle — live `/hello` | `http://8080-e491a14b-8caa-4d44-b57d-54587ad1e9e5.35-225-105-127.sslip.io:4000/hello` |
| Sealed Beagle — sealed task service | `POST …:4000/api/answer` `{"task":"…"}` (the agent registered this itself from inside the TEE) |
| Example: job #5 settled by X-Agent-Proof over `/api/answer` | tx `0x3d212b81363d7b9452074d96edf12418091e246486628208b34e11c0aab87552` |
| Example: job #3 settled by X-Agent-Proof over `/hello` | tx `0x0daba338aaf048ddc715eec81e01a98fe4500f6bd18c2d60309f1176997aab51` |
| Example: replayed seal rejected | revert `seal reused` |
| Example: key-signed receipt settled | tx `0xe7f46e03efa7300c519b92881f3ae36520713e047cc1ce5883d197a628947378` (escrow v1) |

## Router network

`ROUTER_NET=mainnet` uses `0gm-1.0-35b-a3b` on `router-api.0g.ai` (needs 0G deposited at pc.0g.ai). `ROUTER_NET=testnet` uses `qwen2.5-omni` on the testnet Router (deposit faucet 0G at pc.testnet.0g.ai). Both are TEE-attested and return `x_0g_trace.tee_verified`; the receipt format is identical. Example testnet run: job #6 tx `0x121cbd67019d16aafeebfdf88f1d00b60c434027054438542086b30bf9fd6f7c`.

## Run it

```bash
pnpm install
cp .env.example .env         # fill ROUTER_MAINNET_KEY, DEPLOYER_KEY (funded on Galileo), AGENT_KEY
pnpm compile && pnpm deploy   # deploys ProofEscrow, writes ESCROW_ADDRESS to .env
node scripts/agentic-deploy.mjs   # optional: mint + run a sealed agent via the 0G attestor (needs ~0.4 0G)
pnpm start                    # http://localhost:3000
```

## Verify a seal yourself (no gas)

```bash
curl -si -H "X-Client-Address: 0xYOU" http://8080-e491a14b-8caa-4d44-b57d-54587ad1e9e5.35-225-105-127.sslip.io:4000/hello | grep -i x-agent-proof
```

Split on the first `.`: left is a 65-byte EIP-191 signature, right is base64url JSON
`{agent_id, submitter, timestamp, deadline, task_hash, data_hashes, framework_hash}`.
Digest = `keccak256(abi.encode(chainId, agenticIdAddr, submitter, agentId, timestamp, deadline, taskHash, keccak256(abi.encodePacked(dataHashes)), frameworkHash))`,
EIP-191-wrap it, `ecrecover`, compare with `getAgentSeal(agent_id)` on chain. That is exactly what `ProofEscrow.settleWithSeal` does.

## Why this matters

* **Aligned incentives.** Both sides want the receipt: the agent to get paid, the client to prove what it paid for.
* **No trust in the operator.** The seal key lives only inside the TEE. Not the owner, not 0G, not us can forge a serve.
* **Composable.** The escrow accepts the *same* ServeProof as 0G's ERC-8004 reputation registry, so one serve can settle payment **and** earn verifiable reputation.
* **Next:** stamp-gated reviews after payout, multi-hop jobs (Beagle hires a checker; escrow requires both seals), and a customer-support "receipts" mode for AI chatbots.
