# Account Abstraction Wallet

Smart contract accounts on Stacks. Clarity 6, testnet only, **not audited**.

## Credit

Modelled, with the author's permission, on
[friedger/Smart-Wallet](https://github.com/friedger/Smart-Wallet) by Friedger.
The wallet and extension design, the rule sets and `ext-sponsored-sbtc-transfer` come from there.
New here: `as-contract?` allowances, daily limits, the extension allow-list, delays, guardians and
recovery, and the app.

## Contracts

| Contract | Purpose |
|---|---|
| `smart-wallet` | One per user: transfers, extension calls, admins, guardians, recovery |
| `rules/standard-rules` | Daily limits and extension allow-list, shared, keyed by wallet |
| `rules/emergency-rules` | Denies all spending while a wallet is frozen |
| `extensions/ext-sponsored-sbtc-transfer` | Sends sBTC and pays the transaction sponsor in sBTC |
| `mocks/*` | Tests only, never deployed |

## Security model

- **Only `contract-caller` is authorised**, so a contract an admin calls cannot act on the wallet.
- **Calls are bounded.** A token or extension can only move what the call states. Anything more reverts.
- **Unknown tokens, NFT collections and extensions are blocked** until given a limit or approved.
- **Weakening changes wait, strengthening changes are immediate** (after `complete-setup`):
  raising limits, approving extensions and unfreezing take 144 Bitcoin blocks (about a day);
  changing guardians takes 432 (about three days).
- **Recovery:** a majority of 3 to 5 guardians replaces all admins after 144 blocks. An admin can
  cancel it, unless every guardian agrees, which evicts a thief who holds an admin key.

Known limits:

- Guardians who all agree can take over the wallet. Choose them accordingly.
- A thief with an admin key can spend up to the daily limits until a guardian freezes the wallet, and
  can call approved extensions.
- Admins are added and removed at once. After a recovery, review limits and extensions:
  existing ones are kept.
- A day is a fixed bucket of 144 blocks, so twice the limit can be spent around a boundary.
- Before `complete-setup` there are no delays.
- Allowances cover assets in the wallet, not assets held for it by other protocols. Approve only
  tokens and extensions you trust.

## Not supported

- Stacking. PoX-5 removed `delegate-stx`, so the pox-4 extension was retired.
- SIP-013, passkeys, session keys, a relayer service.

## Develop

```
npm install && npm test
STACKS_PRIVATE_KEY=... npm run deploy:testnet   # then: npm run build:wallet-source
cd my-smart-wallet && npm install && npm run dev
```

Testnet addresses are in `deployments/testnet.json`.
