// Deploys the shared contracts and one demo wallet to Stacks testnet.
//   STACKS_PRIVATE_KEY=<testnet key> npm run deploy:testnet
// Safe to rerun: contracts that already exist are skipped.
import { readFileSync, writeFileSync } from "node:fs";
import {
  broadcastTransaction, fetchNonce, getAddressFromPrivateKey, makeContractDeploy, PostConditionMode,
} from "@stacks/transactions";

const API = "https://api.testnet.hiro.so";
const MAINNET_SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const TESTNET_SBTC = "SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token"; // the one pox-5 uses
const FILES = [
  "extension-trait", "rule-set-trait", "sip-009-trait", "sip-010-trait",
  "rules/emergency-rules", "rules/standard-rules",
  "extensions/ext-sponsored-sbtc-transfer", "smart-wallet",
];

const senderKey = process.env.STACKS_PRIVATE_KEY;
if (!senderKey) throw new Error("Set STACKS_PRIVATE_KEY to a testnet key");
const address = getAddressFromPrivateKey(senderKey, "testnet");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sourceOf = (file) =>
  readFileSync(`contracts/${file}.clar`, "utf8").replaceAll(MAINNET_SBTC, TESTNET_SBTC);

const deployed = {};
let nonce = await fetchNonce({ address, network: "testnet" });
for (const file of FILES) {
  const contractName = file.split("/").pop();
  const codeBody = sourceOf(file);
  const existing = await fetch(`${API}/v2/contracts/source/${address}/${contractName}?proof=0`);
  if (existing.ok) {
    if ((await existing.json()).source !== codeBody)
      throw new Error(`${contractName} is deployed with different code; use a new key`);
    console.log("exists ", contractName);
    deployed[contractName] = null;
    continue;
  }
  const transaction = await makeContractDeploy({
    contractName, codeBody, senderKey, nonce: nonce++, network: "testnet", clarityVersion: 6,
    fee: 1000 + codeBody.length * 2, postConditions: [], postConditionMode: PostConditionMode.Deny,
  });
  const result = await broadcastTransaction({ transaction, network: "testnet" });
  if (!result.txid || result.error) throw new Error(JSON.stringify(result));
  deployed[contractName] = result.txid;
  console.log("sent   ", contractName, result.txid);
}

for (const [name, txid] of Object.entries(deployed)) {
  for (let i = 0; txid; i++) {
    const { tx_status: status, tx_result } = await (await fetch(`${API}/extended/v1/tx/${txid}`)).json();
    if (status === "success") break;
    if (status && status !== "pending") throw new Error(`${name}: ${status} ${tx_result?.repr}`);
    if (i > 60) throw new Error(`${name}: not confirmed yet, rerun later`);
    await sleep(5000);
  }
  console.log("live   ", `${address}.${name}`);
}
writeFileSync("deployments/testnet.json",
  JSON.stringify({ network: "testnet", deployer: address, sbtc: TESTNET_SBTC, txids: deployed }, null, 2) + "\n");
