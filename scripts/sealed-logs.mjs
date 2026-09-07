import "dotenv/config";
import { AgenticID } from "@0gfoundation/0g-agenticid-sdk";
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
const ag = await AgenticID.fromAttestor(process.env.AGENTIC_ATTESTOR_URL, { account: process.env.DEPLOYER_KEY });
const agent = await ag.agent.client(BigInt(process.env.SEALED_AGENT_ID));
if (!agent.logs) { console.error("no logs capability"); process.exit(1); }
const tail = await agent.logs({ tail: Number(process.argv[2] || 120) });
console.log(tail);
