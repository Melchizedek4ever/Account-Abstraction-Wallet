;; title: emergency-rules
;; summary: Deny everything. Active while a wallet is frozen.
;; Adapted from friedger/Smart-Wallet.
(define-public (is-allowed-stx (amount uint) (recipient principal)) (ok false))
(define-public (is-allowed-sip010 (token principal) (amount uint) (recipient principal)) (ok false))
(define-public (is-allowed-sip009 (token principal) (id uint) (recipient principal)) (ok false))
(define-public (is-allowed-extension
    (extension principal)
    (stx uint)
    (ft (optional { token: principal, amount: uint })))
  (ok false))
