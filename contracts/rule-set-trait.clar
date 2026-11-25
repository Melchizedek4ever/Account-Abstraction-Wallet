;; Spending rules consulted by a smart wallet before it moves assets.
;; Modelled on rule-set-trait in friedger/Smart-Wallet. The wallet rejects (ok false).
(define-trait rule-set-trait (
  (is-allowed-stx (uint principal) (response bool uint))
  (is-allowed-sip010 (principal uint principal) (response bool uint))
  (is-allowed-sip009 (principal uint principal) (response bool uint))
  (is-allowed-extension
    (principal uint (optional { token: principal, amount: uint }))
    (response bool uint))
))
