;; title: standard-rules
;; summary: Daily spending limits and an extension allow-list, kept per wallet.
;; Based on the rules idea in friedger/Smart-Wallet. One deployment serves every
;; wallet: all state is keyed by contract-caller, so a wallet only affects itself.

;; A "day" is a fixed bucket of 144 burn blocks, not a rolling window: up to twice
;; the limit can be spent around a bucket boundary.
(define-constant day-length u144)
(define-constant default-stx-limit u100000000) ;; 100 STX

;; asset: none = STX, (some contract) = SIP-010 token or SIP-009 collection
(define-map limits { wallet: principal, asset: (optional principal) } uint)
(define-map spent { wallet: principal, asset: (optional principal), day: uint } uint)
(define-map extensions { wallet: principal, extension: principal } bool)

(define-read-only (current-day)
  (/ burn-block-height day-length))

;; Unknown tokens have a limit of 0 and are therefore blocked.
(define-read-only (get-limit (wallet principal) (asset (optional principal)))
  (default-to (if (is-none asset) default-stx-limit u0)
    (map-get? limits { wallet: wallet, asset: asset })))

(define-read-only (get-spent (wallet principal) (asset (optional principal)))
  (default-to u0
    (map-get? spent { wallet: wallet, asset: asset, day: (current-day) })))

(define-read-only (is-extension-enabled (wallet principal) (extension principal))
  (default-to false (map-get? extensions { wallet: wallet, extension: extension })))

(define-private (charge (asset (optional principal)) (amount uint))
  (let ((total (+ amount (get-spent contract-caller asset))))
    (and
      (<= total (get-limit contract-caller asset))
      (map-set spent
        { wallet: contract-caller, asset: asset, day: (current-day) } total))))

(define-public (is-allowed-stx (amount uint) (recipient principal))
  (ok (charge none amount)))

(define-public (is-allowed-sip010 (token principal) (amount uint) (recipient principal))
  (ok (charge (some token) amount)))

;; For a collection the limit is the number of NFTs per day.
(define-public (is-allowed-sip009 (token principal) (id uint) (recipient principal))
  (ok (charge (some token) u1)))

(define-public (is-allowed-extension
    (extension principal)
    (stx uint)
    (ft (optional { token: principal, amount: uint })))
  (ok (and
    (is-extension-enabled contract-caller extension)
    (charge none stx)
    (match ft f (charge (some (get token f)) (get amount f)) true))))

;; configuration, called by the wallet itself
(define-public (set-limit (asset (optional principal)) (limit uint))
  (ok (map-set limits { wallet: contract-caller, asset: asset } limit)))

(define-public (set-extension (extension principal) (enabled bool))
  (ok (map-set extensions { wallet: contract-caller, extension: extension } enabled)))
