# Demo script: Pinky Promise

Three minutes on stage. Two browser tabs open before you start:

1. `http://localhost:3000/slides` (or `/slides_cn`)
2. `http://localhost:3000` in **Sealed Beagle** mode, scrolled to the top

## Before you walk up (5 minutes)

```bash
cd C:\code\hack-0gtaipei
pnpm start          # server on :3000, prints router + escrow + sealed agent id
```

- Open `http://localhost:3000`. The header pills must show `chain 0G Galileo`, `model qwen2.5-omni`, `escrow 0xac8f…`, `agent #383`. If `agent` is missing, the sealed Beagle is offline; demo the key mode only.
- Run **one full pass in Sealed Beagle mode** right now (lock, work, submit). This warms the attestor, confirms the seal is live, and proves the deployer wallet has gas. Reload the page after.
- Check the sealed Beagle answers: `curl -s http://8080-e491a14b-8caa-4d44-b57d-54587ad1e9e5.35-225-105-127.sslip.io:4000/hello | head -c 200`. Any JSON is fine.
- Deployer balance should be above 0.5 0G. It was 3.6 0G after the last top-up.
- Close every other tab. Zoom the browser to 110 percent so the back row can read the bubble.

Do not chat with the sealed Beagle before the demo. Each message costs mainnet Router credit, and that account is empty.

## The talk track

### 0:00 Slide 1, title

> Agents are starting to take jobs and hire other agents. When nobody is watching between hops, "I trust you" stops being a security model. Pinky Promise is an escrow that pays an AI agent only when it can prove it did the work. Beagle is the worker. Capybara guards the chest. A cryptographic seal opens it.

### 0:25 Slide 2, problem

> Today the payer has two bad options: trust the agent's word, or trust the operator who could swap the model or invent the answer. Reputation doesn't fix it. After removing Sybil feedback, 86 percent of rated agents in one ERC-8004 study had no genuine feedback left. Reviews without a proof of service are free to fake.

### 0:45 Slide 3, how it works

Point at the four cards in order.

> Client locks a bounty on 0G Galileo. Beagle runs the task on 0G Compute with verify_tee, so the provider's TEE signs the inference. Beagle is a 0G Agentic ID living in a TEE, and every reply carries an X-Agent-Proof signed by a key that only exists in there. Capybara, the contract, recovers the signer, checks it against getAgentSeal on chain, and opens the chest. Same digest the ERC-8004 reputation registry uses, so one seal settles payment and earns reputation.

### 1:10 Switch to the demo tab

Say what you are about to click before you click it. Let each animation finish.

1. **Lock funds.** Say: "I'm the client. I lock 0.01 0G with the task hash and Beagle's Agentic ID." Wait for the chest to open and the bubble to say the job is funded. Point at the transaction link in the right column.
2. **Send Beagle to work.** Say: "Beagle is Agentic ID 383, running inside a TEE sandbox that 0G's attestor provisioned. I'm calling its service with my address." Wait for the seal to slam onto the proof card. Say: "That header is the X-Agent-Proof. The signer matches the AgentSeal registered on chain for agent 383, and it names me as the only one who can redeem it."
3. **Try a forged proof.** Say: "An impostor changes one hash." Capybara shakes its head. Read the rejection reason from the bubble.
4. **Submit proof.** Say: "Now the real seal." Coins fly to Beagle. Say: "Capybara rebuilt the digest on chain, recovered the signer, matched getAgentSeal, and paid the seal address. That's a real transaction on Galileo." Click the transaction link if there's time.
5. **Replay the seal.** Say: "Same seal, second job." Rejected with `seal reused`. Say: "One serve, one seal, one payout."

### 2:20 Slide 4, proof

> All of this is live on Galileo now. Beagle registered its own signed service from inside the TEE. The chest opened on a real seal, a replay was refused, a forgery was refused. Both 0G products are in the loop: TEE-verified inference on 0G Compute, and ERC-7857 identity with ERC-8004-compatible proofs.

Close:

> Pay-on-proof is the settlement layer the agent economy is missing. Next we gate reviews on the same seal, chain multi-hop jobs where Beagle hires a checker, and give customer-facing bots receipts. 0G is the stack where the proof exists at every layer.

## If something breaks

| Symptom | Do this |
|---|---|
| Sealed mode fails at "Send Beagle to work" | Switch to **Beagle with a key**. Same three clicks. Say the key-signed receipt commits to the 0G Compute TEE trace, and show the offline checker with "one word changed". |
| "Lock funds" hangs past 20 seconds | Galileo is slow to return receipts. Wait. The server retries for a minute. |
| Bubble says `Insufficient balance` in key mode | The testnet Router account ran dry. Deposit at pc.testnet.0g.ai. The sealed mode still works because the seal does not need inference. |
| Page shows no `agent #383` pill | Sealed Beagle is down. Demo key mode and say the sealed path is in the README with transaction hashes. |
| Judges ask to verify a seal themselves | Give them the curl from the README's "Verify a seal yourself" section. The header comes back in one call. |

## What the sealed Beagle's answer text says

Its `/api/answer` returns an error string right now because its model key on the mainnet Router ran out of credit. The seal, the on-chain check, and the payout do not depend on the model. If a judge asks, say exactly that. Do not try to fix it live.

## Likely questions

- **Why not just trust the TEE inference proof?** It proves the model produced the output. It does not prove which agent served which client. The Agentic ID seal adds the "who", and the escrow needs the "who" to pay.
- **Can the owner fake a seal?** No. The AgentSeal key is derived inside the TEE by 0G's KMS and never leaves. The owner can start, stop, and reset the agent, but not sign as it.
- **What stops the agent from re-using a seal?** The escrow stores every seal digest it has paid. A second submission reverts with `seal reused`. The reputation registry does the same with a nonce.
- **What is on chain?** `ProofEscrow` at `0xac8faab5e74824fb24701e4ef2733754854efb95`, the AgenticID contract at `0x5BB50987521A3fb7Da6Cd6aCC0ad1061D975B24A`, and agent 383's seal address `0x9891fa22308e1dc4570a9df51af89f4b1c092c0b`.
- **Business model?** A fee on settlement, or per-stamp pricing. Volume scales with agent calls.
