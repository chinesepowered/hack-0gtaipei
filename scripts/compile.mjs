import solc from "solc";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync("contracts/ProofEscrow.sol", "utf8");
const input = {
  language: "Solidity",
  sources: { "ProofEscrow.sol": { content: src } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors || []).filter((e) => e.severity === "error");
if (errs.length) { console.error(errs.map((e) => e.formattedMessage).join("\n")); process.exit(1); }
const c = out.contracts["ProofEscrow.sol"].ProofEscrow;
mkdirSync("out", { recursive: true });
writeFileSync("out/ProofEscrow.json", JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2));
console.log("compiled -> out/ProofEscrow.json", c.evm.bytecode.object.length / 2, "bytes");
