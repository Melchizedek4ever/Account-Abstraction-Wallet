import { Cl, type ClarityValue } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const acc = (n: string) => accounts.get(n)!;
const deployer = simnet.deployer;
const admin = deployer;
const bob = acc("wallet_1");
const thief = acc("wallet_3");
const [g1, g2, g3] = [acc("wallet_4"), acc("wallet_5"), acc("wallet_6")];
const newOwner = acc("wallet_7");
const W = `${deployer}.smart-wallet`;
const c = (name: string) => Cl.contractPrincipal(deployer, name);
const asset = (name: string) => Cl.some(c(name));
const STX = Cl.none();
const USTX = 1_000_000;

const ERR = {
  unauthorised: 4001, forbidden: 4003, notAllowed: 4004, allowance: 4005,
  nothingPending: 4006, tooEarly: 4007, invalidGuardians: 4008, recoveryActive: 4009,
};

const call = (fn: string, args: ClarityValue[] = [], who = admin) =>
  simnet.callPublicFn("smart-wallet", fn, args, who).result;
const on = (contract: string, fn: string, args: ClarityValue[]) =>
  expect(simnet.callPublicFn(contract, fn, args, deployer).result.type).toBe("ok");
const ok = (r: ClarityValue) => expect(r).toBeOk(Cl.bool(true));
const fail = (r: ClarityValue, code: number) => expect(r).toBeErr(Cl.uint(code));
const stx = (who: string) => simnet.getAssetsMap().get("STX")!.get(who) ?? 0n;
const sendStx = (amount: number, who = admin) =>
  call("stx-transfer", [Cl.uint(amount), Cl.principal(bob), Cl.none()], who);
const sendFt = (amount: number, who = admin) =>
  call("sip010-transfer", [Cl.uint(amount), Cl.principal(bob), Cl.none(), c("mock-ft")], who);
const sendNft = (id: number, who = admin) =>
  call("sip009-transfer", [Cl.uint(id), Cl.principal(bob), c("mock-nft")], who);
const ext = (amount: number, allowed: number, who = admin) =>
  call("extension-call",
    [c("mock-ext"), Cl.bufferFromHex(Cl.serialize(Cl.uint(amount))), Cl.uint(allowed), Cl.none()], who);
const guardianList = (...g: string[]) => Cl.list(g.map((x) => Cl.principal(x)));
const vote = (g: string, candidate = newOwner) => call("vote-recovery", [Cl.principal(candidate)], g);
const ftBalance = (who: string) =>
  simnet.callReadOnlyFn("mock-ft", "get-balance", [Cl.principal(who)], deployer).result;

beforeEach(() => {
  simnet.transferSTX(1000 * USTX, W, acc("wallet_8"));
  on("mock-ft", "mint", [Cl.uint(1000), Cl.principal(W)]);
  on("mock-nft", "mint", [Cl.uint(1), Cl.principal(W)]);
  on("mock-nft", "mint", [Cl.uint(2), Cl.principal(W)]);
});

describe("transfers", () => {
  it("sends STX, with and without memo", () => {
    const before = stx(bob);
    ok(sendStx(100));
    ok(call("stx-transfer", [Cl.uint(50), Cl.principal(bob), Cl.some(Cl.bufferFromUtf8("hi"))]));
    expect(stx(bob) - before).toBe(150n);
  });

  it("sends SIP-010 tokens the wallet holds", () => {
    ok(call("set-limit", [asset("mock-ft"), Cl.uint(500)]));
    ok(sendFt(200));
    expect(ftBalance(bob)).toBeOk(Cl.uint(200));
    expect(ftBalance(W)).toBeOk(Cl.uint(800));
  });

  it("sends SIP-009 NFTs the wallet holds", () => {
    ok(call("set-limit", [asset("mock-nft"), Cl.uint(1)]));
    ok(sendNft(1));
    expect(simnet.callReadOnlyFn("mock-nft", "get-owner", [Cl.uint(1)], deployer).result)
      .toBeOk(Cl.some(Cl.principal(bob)));
    fail(sendNft(2), ERR.notAllowed); // one per day
  });

  it("refuses callers who are not admin", () => {
    fail(sendStx(1, thief), ERR.unauthorised);
    fail(sendFt(1, thief), ERR.unauthorised);
    fail(sendNft(1, thief), ERR.unauthorised);
    fail(ext(1, 1, thief), ERR.unauthorised);
  });

  it("blocks tokens without a limit", () => {
    fail(sendFt(1), ERR.notAllowed);
    fail(sendNft(1), ERR.notAllowed);
  });

  it("stops a malicious token from taking the wallet's STX", () => {
    ok(call("set-limit", [asset("mock-ft"), Cl.uint(500)]));
    on("mock-ft", "set-greedy", [Cl.bool(true)]);
    const before = stx(W);
    fail(sendFt(1), ERR.allowance);
    expect(stx(W)).toBe(before);
    expect(ftBalance(W)).toBeOk(Cl.uint(1000));
  });

  it("stops a malicious collection from taking another NFT", () => {
    ok(call("set-limit", [asset("mock-nft"), Cl.uint(5)]));
    on("mock-nft", "set-greedy", [Cl.bool(true)]);
    fail(sendNft(1), ERR.allowance);
  });
});

describe("spending limits", () => {
  it("enforces the default daily STX limit and resets it the next day", () => {
    ok(sendStx(60 * USTX));
    fail(sendStx(41 * USTX), ERR.notAllowed);
    ok(sendStx(40 * USTX));
    fail(sendStx(1), ERR.notAllowed);
    simnet.mineEmptyBurnBlocks(144);
    ok(sendStx(100 * USTX));
  });

  it("does not charge a failed transfer", () => {
    ok(call("set-limit", [asset("mock-ft"), Cl.uint(2000)]));
    fail(sendFt(1500), 1);
    ok(sendFt(1000));
  });

  it("lowers at once but raises only after the delay", () => {
    ok(call("complete-setup"));
    ok(call("set-limit", [STX, Cl.uint(10)]));
    fail(sendStx(11), ERR.notAllowed);
    ok(call("set-limit", [STX, Cl.uint(20)]));
    fail(sendStx(11), ERR.notAllowed);
    fail(call("execute-limit", [STX]), ERR.tooEarly);
    simnet.mineEmptyBurnBlocks(143);
    fail(call("execute-limit", [STX]), ERR.tooEarly);
    simnet.mineEmptyBurnBlocks(1);
    fail(call("execute-limit", [STX], thief), ERR.unauthorised);
    ok(call("execute-limit", [STX]));
    ok(sendStx(20));
    fail(call("execute-limit", [STX]), ERR.nothingPending);
  });

  it("only admins execute pending changes", () => {
    ok(call("set-extension", [c("mock-ext"), Cl.bool(false)]));
    ok(call("complete-setup"));
    ok(call("set-extension", [c("mock-ext"), Cl.bool(true)]));
    ok(call("set-guardians", [guardianList(g1, g2, g3)]));
    simnet.mineEmptyBurnBlocks(432);
    fail(call("execute-extension", [c("mock-ext")], thief), ERR.unauthorised);
    fail(call("execute-guardians", [], thief), ERR.unauthorised);
  });

  it("lowering cancels a pending raise", () => {
    ok(call("complete-setup"));
    ok(call("set-limit", [STX, Cl.uint(900 * USTX)]));
    ok(call("set-limit", [STX, Cl.uint(5)]));
    simnet.mineEmptyBurnBlocks(200);
    fail(call("execute-limit", [STX]), ERR.nothingPending);
  });

  it("keeps rule state separate per caller", () => {
    simnet.callPublicFn("standard-rules", "set-limit", [STX, Cl.uint(0)], thief);
    simnet.callPublicFn("standard-rules", "is-allowed-stx", [Cl.uint(99 * USTX), Cl.principal(bob)], thief);
    ok(sendStx(100 * USTX));
  });
});

describe("extensions", () => {
  it("refuses extensions that are not on the list", () => fail(ext(5, 5), ERR.notAllowed));

  it("cannot approve code that does not exist yet", () => {
    fail(call("set-extension", [c("not-deployed"), Cl.bool(true)]), 4010);
    fail(call("set-extension", [Cl.principal(bob), Cl.bool(true)]), 4010);
  });

  it("lets an approved extension move at most the stated amount", () => {
    ok(call("set-extension", [c("mock-ext"), Cl.bool(true)]));
    ok(ext(5, 5));
    fail(ext(6, 5), ERR.allowance);
    fail(ext(1, 0), ERR.allowance);
  });

  it("charges extension spending against the daily limit", () => {
    ok(call("set-extension", [c("mock-ext"), Cl.bool(true)]));
    fail(ext(101 * USTX, 101 * USTX), ERR.notAllowed);
    ok(ext(100 * USTX, 100 * USTX));
    fail(sendStx(1), ERR.notAllowed);
  });

  it("approves after a delay and revokes at once", () => {
    ok(call("complete-setup"));
    ok(call("set-extension", [c("mock-ext"), Cl.bool(true)]));
    fail(ext(1, 1), ERR.notAllowed);
    fail(call("execute-extension", [c("mock-ext")]), ERR.tooEarly);
    simnet.mineEmptyBurnBlocks(144);
    ok(call("execute-extension", [c("mock-ext")]));
    ok(ext(1, 1));
    ok(call("set-extension", [c("mock-ext"), Cl.bool(false)]));
    fail(ext(1, 1), ERR.notAllowed);
  });

  it("runs the sBTC extension within the sBTC limit", () => {
    const sbtc = Cl.contractPrincipal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token");
    const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
    const bal = (who: string) => simnet.callReadOnlyFn(
      SBTC, "get-balance", [Cl.principal(who)], deployer).result;
    simnet.callPublicFn(SBTC, "transfer",
      [Cl.uint(1000), Cl.principal(deployer), Cl.principal(W), Cl.none()], deployer);
    expect(bal(W)).toBeOk(Cl.uint(1000));
    const before = BigInt((bal(bob) as any).value.value);
    const pay = (amount: number, cap: number) => call("extension-call", [
      c("ext-sponsored-sbtc-transfer"),
      Cl.bufferFromHex(Cl.serialize(Cl.tuple({ amount: Cl.uint(amount), to: Cl.principal(bob), fees: Cl.uint(1) }))),
      Cl.uint(0),
      Cl.some(Cl.tuple({ token: sbtc, amount: Cl.uint(cap) })),
    ]);
    ok(call("set-extension", [c("ext-sponsored-sbtc-transfer"), Cl.bool(true)]));
    fail(pay(100, 100), ERR.notAllowed); // no sBTC limit yet
    ok(call("set-limit", [Cl.some(sbtc), Cl.uint(300)]));
    ok(pay(100, 101));
    fail(pay(100, 99), ERR.allowance);
    fail(pay(100, 200), ERR.notAllowed); // 101 + 200 > 300
    expect(BigInt((bal(bob) as any).value.value) - before).toBe(100n);
  });
});

describe("admins", () => {
  it("adds and removes admins", () => {
    ok(call("enable-admin", [Cl.principal(bob), Cl.bool(true)]));
    ok(sendStx(1, bob));
    ok(call("enable-admin", [Cl.principal(bob), Cl.bool(false)]));
    fail(sendStx(1, bob), ERR.unauthorised);
    fail(call("enable-admin", [Cl.principal(admin), Cl.bool(false)]), ERR.forbidden);
    fail(call("enable-admin", [Cl.principal(thief), Cl.bool(true)], thief), ERR.unauthorised);
  });

  it("transfers the wallet", () => {
    fail(call("transfer-wallet", [Cl.principal(admin)]), ERR.forbidden);
    ok(call("transfer-wallet", [Cl.principal(bob)]));
    fail(sendStx(1), ERR.unauthorised);
    ok(sendStx(1, bob));
  });

  it("ignores a contract that phishes the admin", () =>
    fail(simnet.callPublicFn("mock-ext", "phish", [], admin).result, ERR.unauthorised));

  it("checks the caller on every admin function", () => {
    const calls: [string, ClarityValue[]][] = [
      ["complete-setup", []], ["unfreeze", []], ["execute-unfreeze", []], ["cancel-recovery", []], ["freeze", []],
      ["set-limit", [STX, Cl.uint(1)]], ["set-extension", [c("mock-ext"), Cl.bool(true)]],
      ["set-guardians", [guardianList(g1, g2, g3)]], ["transfer-wallet", [Cl.principal(thief)]],
      ["vote-recovery", [Cl.principal(thief)]],
    ];
    for (const [fn, args] of calls) fail(call(fn, args, thief), ERR.unauthorised);
  });
});

describe("freeze", () => {
  beforeEach(() => {
    ok(call("set-guardians", [guardianList(g1, g2, g3)]));
    ok(call("set-limit", [asset("mock-ft"), Cl.uint(5)]));
    ok(call("set-limit", [asset("mock-nft"), Cl.uint(5)]));
    ok(call("set-extension", [c("mock-ext"), Cl.bool(true)]));
    ok(call("complete-setup"));
  });

  it("blocks all spending, and unfreezes after a delay", () => {
    ok(call("freeze", [], g1));
    for (const r of [sendStx(1), sendFt(1), sendNft(1), ext(1, 1)]) fail(r, ERR.notAllowed);
    fail(call("execute-unfreeze"), ERR.nothingPending);
    ok(call("unfreeze"));
    fail(call("execute-unfreeze"), ERR.tooEarly);
    simnet.mineEmptyBurnBlocks(144);
    ok(call("execute-unfreeze"));
    ok(sendStx(1));
  });

  it("a new freeze drops a pending unfreeze", () => {
    ok(call("freeze"));
    ok(call("unfreeze"));
    ok(call("freeze", [], g2));
    simnet.mineEmptyBurnBlocks(144);
    fail(call("execute-unfreeze"), ERR.nothingPending);
  });
});

describe("recovery", () => {
  beforeEach(() => {
    ok(call("set-guardians", [guardianList(g1, g2, g3)]));
    ok(call("complete-setup"));
  });

  it("rejects bad guardian lists", () => {
    fail(call("set-guardians", [guardianList(g1, g2)]), ERR.invalidGuardians);
    fail(call("set-guardians", [guardianList(g1, g2, g2)]), ERR.invalidGuardians);
  });

  it("replaces a lost admin after a majority and the delay", () => {
    ok(vote(g1));
    fail(call("execute-recovery", [], bob), ERR.nothingPending);
    ok(vote(g2));
    simnet.mineEmptyBurnBlocks(143);
    fail(call("execute-recovery", [], bob), ERR.tooEarly);
    simnet.mineEmptyBurnBlocks(1);
    ok(call("execute-recovery", [], bob));
    fail(sendStx(1), ERR.unauthorised);
    ok(sendStx(1, newOwner));
    fail(call("execute-recovery", [], bob), ERR.nothingPending);
  });

  it("drops every admin and their pending changes, and unfreezes", () => {
    ok(call("enable-admin", [Cl.principal(thief), Cl.bool(true)]));
    ok(call("set-limit", [STX, Cl.uint(900 * USTX)], thief));
    ok(call("set-extension", [c("mock-ext"), Cl.bool(true)], thief));
    ok(call("freeze", [], g1));
    ok(vote(g1)); ok(vote(g2));
    simnet.mineEmptyBurnBlocks(144);
    ok(call("execute-recovery"));
    fail(sendStx(1, thief), ERR.unauthorised);
    fail(call("execute-limit", [STX], newOwner), ERR.nothingPending);
    fail(call("execute-extension", [c("mock-ext")], newOwner), ERR.nothingPending);
    ok(sendStx(1, newOwner));
  });

  it("does not count one guardian twice or split votes", () => {
    ok(vote(g1)); ok(vote(g1)); ok(vote(g2, thief));
    simnet.mineEmptyBurnBlocks(144);
    fail(call("execute-recovery"), ERR.nothingPending);
  });

  it("restarts the delay when a vote is withdrawn and returns", () => {
    ok(vote(g1)); ok(vote(g2));
    simnet.mineEmptyBurnBlocks(144);
    ok(vote(g2, thief));
    fail(call("execute-recovery"), ERR.nothingPending);
    ok(vote(g2));
    fail(call("execute-recovery"), ERR.tooEarly);
  });

  it("lets the admin cancel a majority, but not a unanimous vote", () => {
    ok(vote(g1)); ok(vote(g2));
    ok(call("cancel-recovery"));
    simnet.mineEmptyBurnBlocks(144);
    fail(call("execute-recovery"), ERR.nothingPending);
    ok(vote(g3)); // earlier votes still stand
    fail(call("cancel-recovery"), ERR.forbidden);
    simnet.mineEmptyBurnBlocks(144);
    ok(call("execute-recovery"));
    ok(sendStx(1, newOwner));
  });

  it("a thief with the admin key cannot swap guardians before they act", () => {
    ok(call("set-guardians", [guardianList(thief, bob, newOwner)]));
    fail(call("execute-guardians"), ERR.tooEarly);
    ok(vote(g1)); ok(vote(g2)); ok(vote(g3));
    simnet.mineEmptyBurnBlocks(432);
    fail(call("execute-guardians"), ERR.recoveryActive);
    ok(call("execute-recovery"));
    fail(sendStx(1), ERR.unauthorised);
    fail(call("execute-guardians", [], newOwner), ERR.nothingPending);
  });

  it("changes guardians after the long delay and drops old votes", () => {
    ok(vote(g1));
    ok(call("set-guardians", [guardianList(g1, bob, newOwner)]));
    simnet.mineEmptyBurnBlocks(432);
    ok(call("execute-guardians"));
    fail(vote(g2), ERR.unauthorised);
    ok(vote(bob));
    simnet.mineEmptyBurnBlocks(144);
    fail(call("execute-recovery"), ERR.nothingPending);
  });
});
