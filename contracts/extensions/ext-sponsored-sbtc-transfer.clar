;; title: ext-sponsored-sbtc-transfer
;; version: 1.0
;; summary: Transfers sBTC and pays a fee to the transaction sponsor, if any.
;; Adapted, with permission, from friedger/Smart-Wallet.
;; On testnet the deploy script replaces the sBTC contract id.

(define-constant err-invalid-payload (err u500))

(define-private (sbtc-transfer
    (amount uint)
    (from principal)
    (to principal)
  )
  (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer
    amount from to none
  )
)

(define-public (call (payload (buff 2048)))
  (let ((details (unwrap!
      (from-consensus-buff? {
        amount: uint,
        to: principal,
        fees: uint,
      }
        payload
      )
      err-invalid-payload
    )))
    (try! (sbtc-transfer (get amount details) tx-sender (get to details)))
    (match tx-sponsor?
      spnsr (let ((fees (get fees details)))
        (and (> fees u0) (try! (sbtc-transfer fees tx-sender spnsr)))
      )
      true
    )
    (ok true)
  )
)