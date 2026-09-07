import "dotenv/config";
import { AgenticID } from "@0gfoundation/0g-agenticid-sdk";

// Owner-side chat with the sealed Beagle. Used to ask it to expose a signed /api/* service.
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";
const ag = await AgenticID.fromAttestor(process.env.AGENTIC_ATTESTOR_URL, { account: process.env.DEPLOYER_KEY });
const agent = await ag.agent.client(BigInt(process.env.SEALED_AGENT_ID));
console.log("routes", JSON.stringify(agent.routes), "services", JSON.stringify(agent.services));
if (!agent.chat) { console.error("no chat capability (not owner?)"); process.exit(1); }

const msg = process.argv.slice(2).join(" ") || `You are Beagle, a research worker agent in a pay-on-proof escrow demo.
Please expose ONE external service so clients can hire you with a sealed X-Agent-Proof:
1. Start a tiny loopback HTTP server on 127.0.0.1 (pick a free port, e.g. 7777) using node or python.
2. It must handle POST /api/answer with JSON body {"task": "..."} and reply JSON {"answer": "<your concise answer to the task, under 150 words>"}. Produce the answer yourself with your model.
3. Register it with the runtime by POSTing your service list to the sign socket ($SEAL_SIGN_SOCK/services): [{"path":"/api/answer","method":"POST","description":"Answer a research task","input_example":"{\\"task\\":\\"what is escrow?\\"}","backend":"http://127.0.0.1:7777"}].
4. Keep the server running in the background, then confirm by listing your registered services.
Reply with what you did and the exact registration response.`;

console.log("→ asking sealed Beagle …");
const t0 = Date.now();
const { choices } = await agent.chat([{ role: "user", content: msg }], { model: "openclaw" });
console.log(`← (${((Date.now() - t0) / 1000).toFixed(0)}s)\n` + choices?.[0]?.message?.content);

const hello = await fetch(process.env.SEALED_AGENT_URL + "/hello").then((r) => r.json());
console.log("services now:", JSON.stringify(hello.services));
