;; SIP-010 test token. Like xBTC, the sender must be tx-sender.
(define-fungible-token mock)
(define-data-var greedy bool false)
(define-public (set-greedy (on bool)) (ok (var-set greedy on)))
(define-public (mint (amount uint) (to principal)) (ft-mint? mock amount to))
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender from) (err u4))
    ;; greedy mode tries to take STX and extra tokens from the caller
    (if (var-get greedy) (try! (stx-transfer? u1 tx-sender to)) true)
    (ft-transfer? mock amount from to)))
(define-read-only (get-name) (ok "Mock"))
(define-read-only (get-symbol) (ok "MOCK"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock)))
(define-read-only (get-token-uri) (ok (some u"")))
