import { publicClient, wallet, feeOpts, escrowArtifact, explorerAddr } from "../src/chain.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const { account, client } = wallet(process.env.DEPLOYER_KEY);
const bal = await publicClient.getBalance({ address: account.address });
console.log("deployer", account.address, "balance", Number(bal) / 1e18, "0G");
if (bal === 0n) { console.error("fund the deployer at https://faucet.0g.ai"); process.exit(1); }

const { abi, bytecode } = escrowArtifact();
// ERC-7857 AgenticID contract used as the X-Agent-Proof signing domain (workshop attestor's dev set on Galileo)
const AGENTIC_ID = process.env.AGENTIC_ID_ADDRESS || "0x5BB50987521A3fb7Da6Cd6aCC0ad1061D975B24A";
const hash = await client.deployContract({ abi, bytecode, args: [AGENTIC_ID], ...feeOpts });
console.log("deploy tx", hash);
const rcpt = await publicClient.waitForTransactionReceipt({ hash });
console.log("ProofEscrow at", rcpt.contractAddress, explorerAddr(rcpt.contractAddress));

const env = readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => !l.startsWith("ESCROW_ADDRESS=")).join("\n").trimEnd();
writeFileSync(".env", env + `\nESCROW_ADDRESS=${rcpt.contractAddress}\n`);
