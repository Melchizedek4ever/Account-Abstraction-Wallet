// Completes a recovery whose delay has passed. Anyone may do this.
//   WALLET=ST….smart-wallet STACKS_PRIVATE_KEY=<any funded testnet key> npm run recovery:execute
import { broadcastTransaction, cvToValue, fetchCallReadOnlyFunction, makeContractCall, PostConditionMode } from "@stacks/transactions";

const { WALLET, STACKS_PRIVATE_KEY: senderKey } = process.env;
if (!WALLET || !senderKey) throw new Error("Set WALLET and STACKS_PRIVATE_KEY");
const [contractAddress, contractName] = WALLET.split(".");
const status = cvToValue(await fetchCallReadOnlyFunction({
  contractAddress, contractName, functionName: "get-status", functionArgs: [],
  senderAddress: contractAddress, network: "testnet",
}));
const active = status.recovery.value?.value;
if (!active) throw new Error("No recovery in progress");
const { burn_block_height: now } = await (await fetch("https://api.testnet.hiro.so/v2/info")).json();
const readyAt = Number(active["ready-at"].value);
if (now < readyAt) {
  console.log(`Not yet: ready at Bitcoin block ${readyAt}, now ${now}`);
  process.exit(1);
}
const transaction = await makeContractCall({
  contractAddress, contractName, functionName: "execute-recovery", functionArgs: [], senderKey,
  network: "testnet", fee: 6000, postConditions: [], postConditionMode: PostConditionMode.Deny,
});
console.log(await broadcastTransaction({ transaction, network: "testnet" }));
