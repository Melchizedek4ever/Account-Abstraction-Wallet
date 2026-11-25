import { request } from "@stacks/connect";
import {
  Cl, type ClarityValue, cvToValue, fetchCallReadOnlyFunction, Pc, type PostCondition, validateStacksAddress,
} from "@stacks/transactions";
import { DEPLOYER, SBTC, WALLET_SOURCE } from "./generated";

export const API = "https://api.testnet.hiro.so";
const NETWORK = "testnet" as const;
export const SBTC_EXTENSION = `${DEPLOYER}.ext-sponsored-sbtc-transfer`;
type ContractId = `${string}.${string}`;

export function isPrincipal(value: string): boolean {
  const [address, name, ...rest] = value.split(".");
  return rest.length === 0 && /^S[TN]/.test(address) && validateStacksAddress(address) &&
    (name === undefined || /^[a-zA-Z][a-zA-Z0-9-]{0,127}$/.test(name));
}
export const isContract = (value: string): value is ContractId => value.includes(".") && isPrincipal(value);

/** Decimal text to base units, without floating point. */
export function toUnits(text: string, decimals: number): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  const fraction = match?.[2] ?? "";
  if (!match || fraction.length > decimals) throw new Error(`Enter an amount with at most ${decimals} decimals`);
  return BigInt(match[1] + fraction.padEnd(decimals, "0"));
}
export function fromUnits(units: bigint, decimals: number): string {
  const s = units.toString().padStart(decimals + 1, "0");
  const fraction = decimals ? s.slice(-decimals).replace(/0+$/, "") : "";
  return s.slice(0, s.length - decimals) + (fraction && `.${fraction}`);
}

async function getJson(path: string) {
  const res = await fetch(API + path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Stacks API returned ${res.status}`);
  return res.json();
}

async function readOnly(contract: ContractId, functionName: string, functionArgs: ClarityValue[]) {
  const [contractAddress, contractName] = contract.split(".");
  return fetchCallReadOnlyFunction({
    contractAddress, contractName, functionName, functionArgs, senderAddress: contractAddress, network: NETWORK,
  });
}

/** Only wallets with exactly the published source are opened: any other
 *  contract could claim to be a smart wallet. */
export async function assertGenuine(wallet: ContractId) {
  const { source } = await getJson(`/v2/contracts/source/${wallet.replace(".", "/")}?proof=0`);
  if (source !== WALLET_SOURCE) throw new Error("This contract does not match the published wallet source");
}

export interface Status {
  stx: bigint; stxLimit: bigint; stxSpent: bigint; sbtcLimit: bigint; sbtc: bigint;
  setupComplete: boolean; frozen: boolean; admin: boolean; guardian: boolean;
  guardians: string[]; recovery: null | { candidate: string; readyAt: number }; burnHeight: number;
}

export async function loadStatus(wallet: ContractId, user: string): Promise<Status> {
  const rules = `${DEPLOYER}.standard-rules` as ContractId;
  const me = Cl.principal(wallet);
  const sbtcAsset = Cl.some(Cl.principal(SBTC));
  const [status, admin, stxLimit, stxSpent, sbtcLimit, sbtc, balance, info] = await Promise.all([
    readOnly(wallet, "get-status", []),
    readOnly(wallet, "is-admin", [Cl.principal(user)]),
    readOnly(rules, "get-limit", [me, Cl.none()]),
    readOnly(rules, "get-spent", [me, Cl.none()]),
    readOnly(rules, "get-limit", [me, sbtcAsset]),
    readOnly(SBTC as ContractId, "get-balance", [me]),
    getJson(`/extended/v1/address/${wallet}/stx`),
    getJson("/v2/info"),
  ]);
  const s = cvToValue(status);
  const guardians: string[] = s.guardians.value.map((g: { value: string }) => g.value);
  const r = s.recovery.value?.value;
  return {
    stx: BigInt(balance.balance), stxLimit: cvToValue(stxLimit), stxSpent: cvToValue(stxSpent),
    sbtcLimit: cvToValue(sbtcLimit), sbtc: BigInt(cvToValue(sbtc).value),
    setupComplete: s["setup-complete"].value, frozen: s["security-level"].value !== "1",
    admin: cvToValue(admin), guardian: guardians.includes(user), guardians,
    recovery: r ? { candidate: r.candidate.value, readyAt: Number(r["ready-at"].value) } : null,
    burnHeight: info.burn_block_height,
  };
}

/** Post-conditions always deny: anything not listed cannot leave any account. */
async function call(wallet: ContractId, functionName: string, functionArgs: ClarityValue[], postConditions: PostCondition[] = []) {
  const result = await request("stx_callContract", {
    contract: wallet, functionName, functionArgs, network: NETWORK, postConditions, postConditionMode: "deny",
  });
  return result.txid ?? "";
}

export async function deployWallet(name: string) {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(name)) throw new Error("Use lowercase letters, digits and dashes");
  const result = await request("stx_deployContract", {
    name, clarityCode: WALLET_SOURCE, clarityVersion: "6", network: NETWORK, postConditions: [], postConditionMode: "deny",
  });
  return result.txid ?? "";
}

export const sendStx = (w: ContractId, amount: bigint, to: string) =>
  call(w, "stx-transfer", [Cl.uint(amount), Cl.principal(to), Cl.none()], [Pc.principal(w).willSendEq(amount).ustx()]);

export async function sendToken(w: ContractId, token: ContractId, amount: bigint, to: string) {
  const abi = await getJson(`/v2/contracts/interface/${token.replace(".", "/")}`);
  const names: string[] = abi.fungible_tokens.map((t: { name: string }) => t.name);
  // sBTC also defines a locked token; everything else must be unambiguous
  const name = token === SBTC ? "sbtc-token" : names.length === 1 ? names[0] : undefined;
  if (!name) throw new Error("Could not determine which token this contract transfers");
  return call(w, "sip010-transfer", [Cl.uint(amount), Cl.principal(to), Cl.none(), Cl.principal(token)],
    [Pc.principal(w).willSendEq(amount).ft(token, name)]);
}

const asset = (token: string) => (token ? Cl.some(Cl.principal(token)) : Cl.none());
export const setLimit = (w: ContractId, token: string, limit: bigint) => call(w, "set-limit", [asset(token), Cl.uint(limit)]);
export const executeLimit = (w: ContractId, token: string) => call(w, "execute-limit", [asset(token)]);
export const setExtension = (w: ContractId, ext: string, on: boolean) => call(w, "set-extension", [Cl.principal(ext), Cl.bool(on)]);
export const executeExtension = (w: ContractId, ext: string) => call(w, "execute-extension", [Cl.principal(ext)]);
export const setGuardians = (w: ContractId, g: string[]) => call(w, "set-guardians", [Cl.list(g.map((x) => Cl.principal(x)))]);
export const voteRecovery = (w: ContractId, candidate: string) => call(w, "vote-recovery", [Cl.principal(candidate)]);
export const simple = (w: ContractId, fn: "complete-setup" | "freeze" | "unfreeze" | "execute-unfreeze" | "execute-guardians" | "cancel-recovery" | "execute-recovery") => call(w, fn, []);
