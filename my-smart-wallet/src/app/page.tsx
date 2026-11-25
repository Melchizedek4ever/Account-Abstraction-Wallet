"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { connect, disconnect, getLocalStorage, isConnected } from "@stacks/connect";
import * as lib from "@/lib/wallet";
import { SBTC } from "@/lib/generated";

type Wallet = `${string}.${string}`;

function Form({ title, hint, fields, action, onSubmit, children }: {
  title: string; hint: string; fields: [name: string, label: string][]; action: string;
  onSubmit: (values: Record<string, string>) => Promise<string>; children?: ReactNode;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v).trim()]));
    void onSubmit(values);
  };
  return (
    <section>
      <h2>{title}</h2>
      <p className="hint">{hint}</p>
      <form onSubmit={submit} className="grid gap-3">
        {fields.map(([name, label]) => (
          <label key={name}>{label}<input name={name} autoComplete="off" spellCheck={false} /></label>
        ))}
        <div className="flex flex-wrap gap-2"><button type="submit">{action}</button>{children}</div>
      </form>
    </section>
  );
}

function principal(value: string) {
  if (!lib.isPrincipal(value)) throw new Error(`"${value}" is not a testnet address`);
  return value;
}
function contract(value: string) {
  if (!lib.isContract(value)) throw new Error(`"${value}" is not a testnet contract`);
  return value;
}

export default function Home() {
  const [user, setUser] = useState("");
  const [wallet, setWallet] = useState<Wallet>();
  const [status, setStatus] = useState<lib.Status>();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isConnected()) setUser(getLocalStorage()?.addresses.stx?.[0]?.address ?? "");
  }, []);

  const refresh = useCallback(async () => {
    if (wallet && user) setStatus(await lib.loadStatus(wallet, user));
  }, [wallet, user]);

  /** Runs an action and reports its outcome; never throws. */
  const run = async (fn: () => Promise<string>) => {
    setMessage("Waiting…");
    try {
      const text = await fn();
      setMessage(/^(0x)?[0-9a-f]{64}$/.test(text) ? `Sent: ${text}. Refresh once it confirms.` : text);
      return text;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      return "";
    }
  };

  const signIn = () => run(async () => {
    const { addresses } = await connect({ network: "testnet" });
    const address = addresses.map((a) => a.address).find((a) => a.startsWith("ST"));
    if (!address) throw new Error("Switch your wallet to testnet, then connect again");
    setUser(address);
    return "Connected";
  });

  const open = (id: string) => run(async () => {
    const w = contract(id);
    setStatus(undefined);
    setWallet(undefined);
    await lib.assertGenuine(w);
    const loaded = await lib.loadStatus(w, user);
    setWallet(w);
    setStatus(loaded);
    return "Wallet opened";
  });

  const tx = (fn: (w: Wallet) => Promise<string>) => () => void run(() => fn(wallet!));

  return (
    <main className="mx-auto grid max-w-2xl gap-5 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Smart Wallet <span className="hint">testnet</span></h1>
        {user
          ? <button onClick={() => { disconnect(); setUser(""); setWallet(undefined); setStatus(undefined); }}>Disconnect</button>
          : <button onClick={signIn}>Connect wallet</button>}
      </header>
      <p role="status" className="hint min-h-5 break-all">{message}</p>

      {!user && <p>Connect a Stacks wallet to create or open a smart wallet.</p>}

      {user && !wallet && <>
        <Form title="Create a wallet" hint="Deploys your own wallet contract. You become its admin."
          fields={[["name", "Contract name"]]} action="Create"
          onSubmit={(v) => run(() => lib.deployWallet(v.name))} />
        <Form title="Open a wallet" hint="Only unmodified copies of the published wallet are opened."
          fields={[["id", "Contract, for example ST….my-wallet"]]} action="Open" onSubmit={(v) => open(v.id)} />
      </>}

      {wallet && status && <>
        <section>
          <h2>Overview</h2>
          <p><code>{wallet}</code></p>
          <dl className="my-3 grid grid-cols-2 gap-1 text-sm">
            <dt>STX</dt><dd>{lib.fromUnits(status.stx, 6)}</dd>
            <dt>sBTC</dt><dd>{lib.fromUnits(status.sbtc, 8)}</dd>
            <dt>STX limit today</dt><dd>{lib.fromUnits(status.stxSpent, 6)} of {lib.fromUnits(status.stxLimit, 6)} used</dd>
            <dt>sBTC limit per day</dt><dd>{lib.fromUnits(status.sbtcLimit, 8)}</dd>
            <dt>Your role</dt><dd>{[status.admin && "admin", status.guardian && "guardian"].filter(Boolean).join(", ") || "none"}</dd>
            <dt>State</dt><dd>{status.frozen ? "Frozen" : "Active"}{status.setupComplete ? "" : ", setup not finished"}</dd>
          </dl>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void run(async () => { await refresh(); return "Updated"; })}>Refresh</button>
            <button onClick={tx((w) => lib.simple(w, "freeze"))}>Freeze</button>
            {status.frozen && <>
              <button onClick={tx((w) => lib.simple(w, "unfreeze"))}>Request unfreeze</button>
              <button onClick={tx((w) => lib.simple(w, "execute-unfreeze"))}>Complete unfreeze</button>
            </>}
            <button onClick={() => { setWallet(undefined); setStatus(undefined); }}>Close</button>
          </div>
        </section>

        {!status.setupComplete && <section>
          <h2>Finish setup</h2>
          <p className="hint">Until you finish, changes apply at once and the delays below do not protect you. Set limits and guardians first. This cannot be undone.</p>
          <button onClick={tx((w) => lib.simple(w, "complete-setup"))}>Finish setup</button>
        </section>}

        <Form title="Send STX" hint="Counts towards the daily limit." action="Send"
          fields={[["amount", "Amount in STX"], ["to", "Recipient"]]}
          onSubmit={(v) => run(() => lib.sendStx(wallet, lib.toUnits(v.amount, 6), principal(v.to)))} />

        <Form title="Send a token" hint={`The token needs a limit first. sBTC is ${SBTC}`} action="Send token"
          fields={[["token", "Token contract"], ["amount", "Amount in base units"], ["to", "Recipient"]]}
          onSubmit={(v) => run(() => lib.sendToken(wallet, contract(v.token), lib.toUnits(v.amount, 0), principal(v.to)))} />

        <Form title="Daily limit" hint="Lowering applies at once. After setup, raising takes about a day. Leave the token empty for STX." action="Set limit"
          fields={[["token", "Token contract (optional)"], ["limit", "Limit in base units (1 STX = 1000000)"]]}
          onSubmit={(v) => run(() => lib.setLimit(wallet, v.token && contract(v.token), lib.toUnits(v.limit, 0)))} />
        <Form title="Complete a limit change" hint="Once the delay has passed." action="Complete"
          fields={[["token", "Token contract (optional)"]]}
          onSubmit={(v) => run(() => lib.executeLimit(wallet, v.token && contract(v.token)))} />

        <Form title="Extensions" hint={`Approve only code you have reviewed. sBTC payments: ${lib.SBTC_EXTENSION}`} action="Approve"
          fields={[["ext", "Extension contract"]]}
          onSubmit={(v) => run(() => lib.setExtension(wallet, contract(v.ext), true))}>
          {([["Complete approval", lib.executeExtension], ["Revoke", (w: Wallet, e: string) => lib.setExtension(w, e, false)]] as const).map(([label, fn]) => (
            <button key={label} type="button" onClick={(e) => {
              const ext = String(new FormData(e.currentTarget.form!).get("ext")).trim();
              void run(() => fn(wallet, contract(ext)));
            }}>{label}</button>
          ))}
        </Form>

        <Form title="Guardians" hint={`Three to five people who can recover this wallet. Changes take about three days after setup. Now: ${status.guardians.join(", ") || "none"}`} action="Set guardians"
          fields={[["list", "Addresses, separated by commas"]]}
          onSubmit={(v) => run(() => lib.setGuardians(wallet, v.list.split(/[\s,]+/).filter(Boolean).map(principal)))}>
          <button type="button" onClick={tx((w) => lib.simple(w, "execute-guardians"))}>Complete change</button>
        </Form>

        <Form title="Recovery" action="Vote as guardian"
          hint={status.recovery
            ? `${status.recovery.candidate} becomes admin at Bitcoin block ${status.recovery.readyAt} (now ${status.burnHeight}).`
            : "A majority of guardians can replace a lost admin after about a day. If all of them agree, an admin cannot cancel it."}
          fields={[["candidate", "New admin"]]}
          onSubmit={(v) => run(() => lib.voteRecovery(wallet, principal(v.candidate)))}>
          <button type="button" onClick={tx((w) => lib.simple(w, "execute-recovery"))}>Complete recovery</button>
          <button type="button" onClick={tx((w) => lib.simple(w, "cancel-recovery"))}>Cancel recovery</button>
        </Form>
      </>}
    </main>
  );
}
