
import type { TypedAbiArg, TypedAbiFunction, TypedAbiMap, TypedAbiVariable, Response } from '@clarigen/core';

export const contracts = {
  extensionTrait: {
  "functions": {
    
  },
  "maps": {
    
  },
  "variables": {
    
  },
  constants: {},
  "non_fungible_tokens": [
    
  ],
  "fungible_tokens":[],"epoch":"Epoch30","clarity_version":"Clarity3",
  contractName: 'extension-trait',
  },
sip009Trait: {
  "functions": {
    
  },
  "maps": {
    
  },
  "variables": {
    
  },
  constants: {},
  "non_fungible_tokens": [
    
  ],
  "fungible_tokens":[],"epoch":"Epoch30","clarity_version":"Clarity3",
  contractName: 'sip-009-trait',
  },
sip010Trait: {
  "functions": {
    
  },
  "maps": {
    
  },
  "variables": {
    
  },
  constants: {},
  "non_fungible_tokens": [
    
  ],
  "fungible_tokens":[],"epoch":"Epoch30","clarity_version":"Clarity3",
  contractName: 'sip-010-trait',
  },
sip013Trait: {
  "functions": {
    
  },
  "maps": {
    
  },
  "variables": {
    
  },
  constants: {},
  "non_fungible_tokens": [
    
  ],
  "fungible_tokens":[],"epoch":"Epoch30","clarity_version":"Clarity3",
  contractName: 'sip-013-trait',
  },
smartWallet: {
  "functions": {
    isAllowedExtension: {"name":"is-allowed-extension","access":"private","args":[{"name":"extension","type":"trait_reference"},{"name":"payload","type":{"buffer":{"length":2048}}}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[extension: TypedAbiArg<string, "extension">, payload: TypedAbiArg<Uint8Array, "payload">], Response<boolean, bigint>>,
    isAllowedSip009: {"name":"is-allowed-sip009","access":"private","args":[{"name":"sip009","type":"trait_reference"},{"name":"amount","type":"uint128"},{"name":"recipient","type":"principal"}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[sip009: TypedAbiArg<string, "sip009">, amount: TypedAbiArg<number | bigint, "amount">, recipient: TypedAbiArg<string, "recipient">], Response<boolean, bigint>>,
    isAllowedSip010: {"name":"is-allowed-sip010","access":"private","args":[{"name":"sip010","type":"trait_reference"},{"name":"amount","type":"uint128"},{"name":"recipient","type":"principal"},{"name":"memo","type":{"optional":{"buffer":{"length":34}}}}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[sip010: TypedAbiArg<string, "sip010">, amount: TypedAbiArg<number | bigint, "amount">, recipient: TypedAbiArg<string, "recipient">, memo: TypedAbiArg<Uint8Array | null, "memo">], Response<boolean, bigint>>,
    isAllowedStx: {"name":"is-allowed-stx","access":"private","args":[{"name":"amount","type":"uint128"},{"name":"recipient","type":"principal"},{"name":"memo","type":{"optional":{"buffer":{"length":34}}}}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[amount: TypedAbiArg<number | bigint, "amount">, recipient: TypedAbiArg<string, "recipient">, memo: TypedAbiArg<Uint8Array | null, "memo">], Response<boolean, bigint>>,
    enableAdmin: {"name":"enable-admin","access":"public","args":[{"name":"admin","type":"principal"},{"name":"enabled","type":"bool"}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[admin: TypedAbiArg<string, "admin">, enabled: TypedAbiArg<boolean, "enabled">], Response<boolean, bigint>>,
    extensionCall: {"name":"extension-call","access":"public","args":[{"name":"extension","type":"trait_reference"},{"name":"payload","type":{"buffer":{"length":2048}}}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[extension: TypedAbiArg<string, "extension">, payload: TypedAbiArg<Uint8Array, "payload">], Response<boolean, bigint>>,
    sip009Transfer: {"name":"sip009-transfer","access":"public","args":[{"name":"nft-id","type":"uint128"},{"name":"recipient","type":"principal"},{"name":"sip009","type":"trait_reference"}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[nftId: TypedAbiArg<number | bigint, "nftId">, recipient: TypedAbiArg<string, "recipient">, sip009: TypedAbiArg<string, "sip009">], Response<boolean, bigint>>,
    sip010Transfer: {"name":"sip010-transfer","access":"public","args":[{"name":"amount","type":"uint128"},{"name":"recipient","type":"principal"},{"name":"memo","type":{"optional":{"buffer":{"length":34}}}},{"name":"sip010","type":"trait_reference"}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[amount: TypedAbiArg<number | bigint, "amount">, recipient: TypedAbiArg<string, "recipient">, memo: TypedAbiArg<Uint8Array | null, "memo">, sip010: TypedAbiArg<string, "sip010">], Response<boolean, bigint>>,
    stxTransfer: {"name":"stx-transfer","access":"public","args":[{"name":"amount","type":"uint128"},{"name":"recipient","type":"principal"},{"name":"memo","type":{"optional":{"buffer":{"length":34}}}}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[amount: TypedAbiArg<number | bigint, "amount">, recipient: TypedAbiArg<string, "recipient">, memo: TypedAbiArg<Uint8Array | null, "memo">], Response<boolean, bigint>>,
    transferWallet: {"name":"transfer-wallet","access":"public","args":[{"name":"new-admin","type":"principal"}],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[newAdmin: TypedAbiArg<string, "newAdmin">], Response<boolean, bigint>>,
    isAdminCalling: {"name":"is-admin-calling","access":"read_only","args":[],"outputs":{"type":{"response":{"ok":"bool","error":"uint128"}}}} as TypedAbiFunction<[], Response<boolean, bigint>>
  },
  "maps": {
    admins: {"name":"admins","key":"principal","value":"bool"} as TypedAbiMap<string, boolean>
  },
  "variables": {
    errForbidden: {
  name: 'err-forbidden',
  type: {
    response: {
      ok: 'none',
      error: 'uint128'
    }
  },
  access: 'constant'
} as TypedAbiVariable<Response<null, bigint>>,
    errUnauthorised: {
  name: 'err-unauthorised',
  type: {
    response: {
      ok: 'none',
      error: 'uint128'
    }
  },
  access: 'constant'
} as TypedAbiVariable<Response<null, bigint>>
  },
  constants: {
  errForbidden: {
    isOk: false,
    value: 403n
  },
  errUnauthorised: {
    isOk: false,
    value: 401n
  }
},
  "non_fungible_tokens": [
    
  ],
  "fungible_tokens":[],"epoch":"Epoch30","clarity_version":"Clarity3",
  contractName: 'smart-wallet',
  },
smartWalletTrait: {
  "functions": {
    
  },
  "maps": {
    
  },
  "variables": {
    
  },
  constants: {},
  "non_fungible_tokens": [
    
  ],
  "fungible_tokens":[],"epoch":"Epoch30","clarity_version":"Clarity3",
  contractName: 'smart-wallet-trait',
  }
} as const;

export const accounts = {"deployer":{"address":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","balance":"99999999999000"},"faucet":{"address":"STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6","balance":"100000000000000"},"wallet_1":{"address":"ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5","balance":"100000000000000"},"wallet_2":{"address":"ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG","balance":"100000000000000"},"wallet_3":{"address":"ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC","balance":"100000000000000"},"wallet_4":{"address":"ST2NEB84ASENDXKYGJPQW86YXQCEFEX2ZQPG87ND","balance":"100000000000000"},"wallet_5":{"address":"ST2REHHS5J3CERCRBEPMGH7921Q6PYKAADT7JP2VB","balance":"100000000000000"},"wallet_6":{"address":"ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0","balance":"100000000000000"},"wallet_7":{"address":"ST3PF13W7Z0RRM42A8VZRVFQ75SV1K26RXEP8YGKJ","balance":"100000000000000"},"wallet_8":{"address":"ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP","balance":"100000000000000"}} as const;

export const identifiers = {"extensionTrait":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.extension-trait","sip009Trait":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-009-trait","sip010Trait":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-010-trait","sip013Trait":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-013-trait","smartWallet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.smart-wallet","smartWalletTrait":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.smart-wallet-trait"} as const

export const simnet = {
  accounts,
  contracts,
  identifiers,
} as const;


export const deployments = {"extensionTrait":{"devnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.extension-trait","simnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.extension-trait","testnet":null,"mainnet":null},"sip009Trait":{"devnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-009-trait","simnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-009-trait","testnet":null,"mainnet":null},"sip010Trait":{"devnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-010-trait","simnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-010-trait","testnet":null,"mainnet":null},"sip013Trait":{"devnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-013-trait","simnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip-013-trait","testnet":null,"mainnet":null},"smartWallet":{"devnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.smart-wallet","simnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.smart-wallet","testnet":null,"mainnet":null},"smartWalletTrait":{"devnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.smart-wallet-trait","simnet":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.smart-wallet-trait","testnet":null,"mainnet":null}} as const;

export const project = {
  contracts,
  deployments,
} as const;
  