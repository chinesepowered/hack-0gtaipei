import "dotenv/config";

// ROUTER_NET=mainnet (0GM, TEE) or testnet (qwen2.5-omni, TEE) — both give x_0g_trace + tee_verified
const NET = process.env.ROUTER_NET || "mainnet";
const BASE = NET === "testnet" ? (process.env.ROUTER_TESTNET_URL || "https://router-api-testnet.integratenetwork.work/v1") : (process.env.ROUTER_MAINNET_URL || "https://router-api.0g.ai/v1");
const KEY = NET === "testnet" ? process.env.ROUTER_TESTNET_KEY : process.env.ROUTER_MAINNET_KEY;
export const MODEL = process.env.MODEL || (NET === "testnet" ? "qwen2.5-omni" : "0gm-1.0-35b-a3b");
export const ROUTER_NET = NET;
export const ROUTER_BASE = BASE;
console.log(`router: ${NET} ${BASE} model=${MODEL}`);

/**
 * Verified inference on 0G Compute Router.
 * Returns the answer plus everything needed to verify the TEE signature later.
 */
export async function verifiedChat(messages, { model = MODEL, maxTokens = 1024 } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "X-0G-Provider-Trust-Mode": "verified" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, reasoning_effort: "low", verify_tee: true }),
  });
  const chatId = res.headers.get("zg-res-key");
  const data = await res.json();
  if (!res.ok) throw new Error(`router ${res.status}: ${JSON.stringify(data)}`);
  const msg = data.choices?.[0]?.message || {};
  const text = (msg.content && msg.content.trim()) || (msg.reasoning_content || "").trim();
  const trace = data.x_0g_trace || {};
  return {
    text,
    model: data.model,
    chatId: chatId || data.id,
    requestId: trace.request_id,
    provider: trace.provider,
    teeVerified: trace.tee_verified ?? null,
    cost: trace.billing?.total_cost,
    usage: data.usage,
    latencyMs: Date.now() - t0,
  };
}

/** Fetch the raw TEE signature from the provider so anyone can re-verify offline (EIP-191 over `text`). */
export async function fetchProviderSignature(providerUrl, chatId, model = MODEL) {
  const r = await fetch(`${providerUrl.replace(/\/$/, "")}/v1/proxy/signature/${chatId}?model=${encodeURIComponent(model)}`);
  if (!r.ok) throw new Error(`signature fetch ${r.status}`);
  return r.json(); // { text, signature }
}
