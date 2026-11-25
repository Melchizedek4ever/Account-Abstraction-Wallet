;; title: smart-wallet
;; version: 2
;; summary: Smart contract account with spending rules, bounded extensions and
;;   guardian recovery. Each user deploys their own copy.
;; Modelled, with permission, on friedger/Smart-Wallet.
(use-trait extension-trait .extension-trait.extension-trait)
(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait sip-009-trait .sip-009-trait.nft-trait)
(use-trait rule-set-trait .rule-set-trait.rule-set-trait)

(define-constant err-unauthorised (err u4001))
(define-constant err-forbidden (err u4003))
(define-constant err-not-allowed (err u4004)) ;; refused by the active rules
(define-constant err-allowance (err u4005))   ;; callee moved more than authorised
(define-constant err-nothing-pending (err u4006))
(define-constant err-too-early (err u4007))
(define-constant err-invalid-guardians (err u4008))
(define-constant err-recovery-active (err u4009))

(define-constant err-no-contract (err u4010))

(define-constant level-standard u1)
(define-constant level-emergency u2)

;; In burn blocks. Guardian changes take longer than recovery, so that a stolen
;; admin key cannot swap the guardians before they are able to act.
(define-constant config-delay u144)    ;; about 1 day
(define-constant recovery-delay u144)  ;; about 1 day
(define-constant guardian-delay u432)  ;; about 3 days
(define-constant min-guardians u3)

;; A recovery increments the epoch, which drops all admins and pending changes.
(define-data-var epoch uint u0)
(define-data-var setup-complete bool false)
(define-data-var security-level uint level-standard)
(define-map admins { epoch: uint, admin: principal } bool)

(define-read-only (is-admin (who principal))
  (default-to false (map-get? admins { epoch: (var-get epoch), admin: who })))

;; contract-caller, not tx-sender: a contract the admin happens to call must not
;; be able to act on the wallet.
(define-read-only (is-admin-calling)
  (ok (asserts! (is-admin contract-caller) err-unauthorised)))

(define-read-only (get-status)
  {
    epoch: (var-get epoch),
    setup-complete: (var-get setup-complete),
    security-level: (var-get security-level),
    guardians: (var-get guardians),
    recovery: (var-get recovery),
  })

;;
;; rules
;;
(define-private (to-trait (rules <rule-set-trait>))
  rules)

(define-private (current-rules)
  (if (is-eq (var-get security-level) level-standard)
    (to-trait .standard-rules)
    (to-trait .emergency-rules)))

(define-private (check-stx (rules <rule-set-trait>) (amount uint) (recipient principal))
  (ok (asserts! (try! (contract-call? rules is-allowed-stx amount recipient))
    err-not-allowed)))

(define-private (check-sip010
    (rules <rule-set-trait>) (token principal) (amount uint) (recipient principal))
  (ok (asserts! (try! (contract-call? rules is-allowed-sip010 token amount recipient))
    err-not-allowed)))

(define-private (check-sip009
    (rules <rule-set-trait>) (token principal) (id uint) (recipient principal))
  (ok (asserts! (try! (contract-call? rules is-allowed-sip009 token id recipient))
    err-not-allowed)))

(define-private (check-extension
    (rules <rule-set-trait>)
    (extension principal)
    (stx uint)
    (ft (optional { token: principal, amount: uint })))
  (ok (asserts! (try! (contract-call? rules is-allowed-extension extension stx ft))
    err-not-allowed)))

;;
;; calls as the wallet. as-contract? caps what the callee can move.
;;
(define-public (stx-transfer
    (amount uint)
    (recipient principal)
    (memo (optional (buff 34))))
  (begin
    (try! (is-admin-calling))
    (try! (check-stx (current-rules) amount recipient))
    (print { a: "stx-transfer", payload: { amount: amount, recipient: recipient, memo: memo } })
    (ok (unwrap!
      (as-contract? ((with-stx amount))
        (try! (match memo
          to-print (stx-transfer-memo? amount tx-sender recipient to-print)
          (stx-transfer? amount tx-sender recipient))))
      err-allowance))))

(define-public (sip010-transfer
    (amount uint)
    (recipient principal)
    (memo (optional (buff 34)))
    (sip010 <sip-010-trait>))
  (let ((token (contract-of sip010)))
    (try! (is-admin-calling))
    (try! (check-sip010 (current-rules) token amount recipient))
    (print { a: "sip010-transfer", payload: { amount: amount, recipient: recipient, memo: memo, sip010: token } })
    (ok (unwrap!
      (as-contract? ((with-ft token "*" amount))
        (try! (contract-call? sip010 transfer amount tx-sender recipient memo)))
      err-allowance))))

(define-public (sip009-transfer
    (nft-id uint)
    (recipient principal)
    (sip009 <sip-009-trait>))
  (let ((token (contract-of sip009)))
    (try! (is-admin-calling))
    (try! (check-sip009 (current-rules) token nft-id recipient))
    (print { a: "sip009-transfer", payload: { nft-id: nft-id, recipient: recipient, sip009: token } })
    (ok (unwrap!
      (as-contract? ((with-nft token "*" (list nft-id)))
        (try! (contract-call? sip009 transfer nft-id tx-sender recipient)))
      err-allowance))))

;; stx and ft are the most the extension may move. Both count towards the daily
;; limits in full, whether or not the extension uses them.
(define-public (extension-call
    (extension <extension-trait>)
    (payload (buff 2048))
    (stx uint)
    (ft (optional { token: principal, amount: uint })))
  (let (
      (token (match ft f (get token f) current-contract))
      (amount (match ft f (get amount f) u0))
    )
    (try! (is-admin-calling))
    (try! (check-extension (current-rules) (contract-of extension) stx ft))
    (print { a: "extension-call", payload: { extension: (contract-of extension), payload: payload, stx: stx, ft: ft } })
    (ok (unwrap!
      (as-contract? ((with-stx stx) (with-ft token "*" amount))
        (try! (contract-call? extension call payload)))
      err-allowance))))

;;
;; admins
;;
(define-public (enable-admin (admin principal) (enabled bool))
  (begin
    (try! (is-admin-calling))
    (asserts! (not (is-eq admin contract-caller)) err-forbidden)
    (print { a: "enable-admin", payload: { admin: admin, enabled: enabled } })
    (ok (map-set admins { epoch: (var-get epoch), admin: admin } enabled))))

(define-public (transfer-wallet (new-admin principal))
  (begin
    (try! (is-admin-calling))
    (asserts! (not (is-eq new-admin contract-caller)) err-forbidden)
    (map-set admins { epoch: (var-get epoch), admin: new-admin } true)
    (map-delete admins { epoch: (var-get epoch), admin: contract-caller })
    (print { a: "transfer-wallet", payload: { new-admin: new-admin } })
    (ok true)))

;;
;; configuration. Anything that weakens protection waits; anything that
;; strengthens it is immediate. Until complete-setup, all changes are immediate.
;;
(define-map pending-limits
  { epoch: uint, asset: (optional principal) }
  { limit: uint, ready-at: uint })
(define-map pending-extensions { epoch: uint, extension: principal } uint)
(define-map pending-unfreeze uint uint) ;; epoch -> ready-at
(define-map pending-guardians
  uint ;; epoch
  { guardians: (list 5 principal), ready-at: uint })

(define-read-only (get-pending-limit (asset (optional principal)))
  (map-get? pending-limits { epoch: (var-get epoch), asset: asset }))
(define-read-only (get-pending-extension (extension principal))
  (map-get? pending-extensions { epoch: (var-get epoch), extension: extension }))
(define-read-only (get-pending-unfreeze)
  (map-get? pending-unfreeze (var-get epoch)))
(define-read-only (get-pending-guardians)
  (map-get? pending-guardians (var-get epoch)))

(define-private (check-ready (ready-at uint))
  (ok (asserts! (>= burn-block-height ready-at) err-too-early)))

(define-public (complete-setup)
  (begin
    (try! (is-admin-calling))
    (print { a: "complete-setup" })
    (ok (var-set setup-complete true))))

(define-public (set-limit (asset (optional principal)) (limit uint))
  (let ((key { epoch: (var-get epoch), asset: asset }))
    (try! (is-admin-calling))
    (print { a: "set-limit", payload: { asset: asset, limit: limit } })
    (if (or
        (not (var-get setup-complete))
        (<= limit (contract-call? .standard-rules get-limit current-contract asset)))
      (begin
        (map-delete pending-limits key)
        (contract-call? .standard-rules set-limit asset limit))
      (ok (map-set pending-limits key
        { limit: limit, ready-at: (+ burn-block-height config-delay) })))))

(define-public (execute-limit (asset (optional principal)))
  (let (
      (key { epoch: (var-get epoch), asset: asset })
      (pending (unwrap! (map-get? pending-limits key) err-nothing-pending))
    )
    (try! (is-admin-calling))
    (try! (check-ready (get ready-at pending)))
    (map-delete pending-limits key)
    (contract-call? .standard-rules set-limit asset (get limit pending))))

(define-public (set-extension (extension principal) (enabled bool))
  (let ((key { epoch: (var-get epoch), extension: extension }))
    (try! (is-admin-calling))
    ;; only existing code can be approved: it can be reviewed and cannot change
    (asserts! (or (not enabled) (is-ok (contract-hash? extension))) err-no-contract)
    (print { a: "set-extension", payload: { extension: extension, enabled: enabled } })
    (if (or (not enabled) (not (var-get setup-complete)))
      (begin
        (map-delete pending-extensions key)
        (contract-call? .standard-rules set-extension extension enabled))
      (ok (map-set pending-extensions key (+ burn-block-height config-delay))))))

(define-public (execute-extension (extension principal))
  (let (
      (key { epoch: (var-get epoch), extension: extension })
      (ready-at (unwrap! (map-get? pending-extensions key) err-nothing-pending))
    )
    (try! (is-admin-calling))
    (try! (check-ready ready-at))
    (map-delete pending-extensions key)
    (contract-call? .standard-rules set-extension extension true)))

(define-public (freeze)
  (begin
    (asserts! (or (is-admin contract-caller) (is-guardian contract-caller)) err-unauthorised)
    (print { a: "freeze" })
    (map-delete pending-unfreeze (var-get epoch))
    (ok (var-set security-level level-emergency))))

(define-public (unfreeze)
  (begin
    (try! (is-admin-calling))
    (print { a: "unfreeze" })
    (ok (if (var-get setup-complete)
      (map-set pending-unfreeze (var-get epoch) (+ burn-block-height config-delay))
      (var-set security-level level-standard)))))

(define-public (execute-unfreeze)
  (begin
    (try! (is-admin-calling))
    (try! (check-ready (unwrap! (get-pending-unfreeze) err-nothing-pending)))
    (map-delete pending-unfreeze (var-get epoch))
    (ok (var-set security-level level-standard))))

;;
;; guardians and recovery
;;
(define-data-var guardians (list 5 principal) (list))
;; A change of guardians or a recovery starts a new round, which drops all votes.
(define-data-var round uint u0)
(define-map votes { round: uint, guardian: principal } principal)
(define-data-var recovery (optional { candidate: principal, ready-at: uint }) none)

(define-read-only (is-guardian (who principal))
  (is-some (index-of? (var-get guardians) who)))

;; A majority, so at most one candidate can reach it.
(define-read-only (get-threshold)
  (+ u1 (/ (len (var-get guardians)) u2)))

(define-read-only (get-vote (guardian principal))
  (map-get? votes { round: (var-get round), guardian: guardian }))

(define-read-only (count-votes (candidate principal))
  (get total (fold count-vote (var-get guardians) { candidate: candidate, total: u0 })))

(define-private (count-vote
    (guardian principal)
    (acc { candidate: principal, total: uint }))
  (if (is-eq (get-vote guardian) (some (get candidate acc)))
    (merge acc { total: (+ u1 (get total acc)) })
    acc))

(define-private (collect-unique
    (who principal)
    (acc (list 5 principal)))
  (if (is-some (index-of? acc who))
    acc
    (default-to acc (as-max-len? (append acc who) u5))))

(define-private (apply-guardians (new-guardians (list 5 principal)))
  (begin
    (var-set guardians new-guardians)
    (var-set recovery none)
    (var-set round (+ u1 (var-get round)))
    (map-delete pending-guardians (var-get epoch))
    true))

(define-public (set-guardians (new-guardians (list 5 principal)))
  (begin
    (try! (is-admin-calling))
    (asserts! (or (is-eq (len new-guardians) u0) (>= (len new-guardians) min-guardians))
      err-invalid-guardians)
    (asserts! (is-eq (len new-guardians) (len (fold collect-unique new-guardians (list))))
      err-invalid-guardians)
    (print { a: "set-guardians", payload: new-guardians })
    (ok (if (var-get setup-complete)
      (map-set pending-guardians (var-get epoch)
        { guardians: new-guardians, ready-at: (+ burn-block-height guardian-delay) })
      (apply-guardians new-guardians)))))

(define-public (execute-guardians)
  (let ((pending (unwrap! (get-pending-guardians) err-nothing-pending)))
    (try! (is-admin-calling))
    (try! (check-ready (get ready-at pending)))
    (asserts! (is-none (var-get recovery)) err-recovery-active)
    (ok (apply-guardians (get guardians pending)))))

;; Guardians vote for the new admin. Votes can be moved to another candidate.
;; The delay starts when a candidate reaches a majority.
(define-public (vote-recovery (candidate principal))
  (begin
    (asserts! (is-guardian contract-caller) err-unauthorised)
    (map-set votes { round: (var-get round), guardian: contract-caller } candidate)
    (print { a: "vote-recovery", payload: { guardian: contract-caller, candidate: candidate } })
    (match (var-get recovery)
      active (if (< (count-votes (get candidate active)) (get-threshold))
        (var-set recovery none)
        true)
      true)
    (ok (if (and
        (is-none (var-get recovery))
        (>= (count-votes candidate) (get-threshold)))
      (var-set recovery
        (some { candidate: candidate, ready-at: (+ burn-block-height recovery-delay) }))
      true))))

;; An admin can stop a recovery, unless every guardian supports it. A lost key
;; needs a majority; evicting a thief who holds an admin key needs all guardians.
;; Votes are kept, or a thief could cancel forever and never let them add up.
(define-public (cancel-recovery)
  (begin
    (try! (is-admin-calling))
    (match (var-get recovery)
      active (asserts!
        (< (count-votes (get candidate active)) (len (var-get guardians)))
        err-forbidden)
      true)
    (print { a: "cancel-recovery" })
    (ok (var-set recovery none))))

;; Anyone can execute a recovery that is ready.
(define-public (execute-recovery)
  (let (
      (active (unwrap! (var-get recovery) err-nothing-pending))
      (new-epoch (+ u1 (var-get epoch)))
    )
    (try! (check-ready (get ready-at active)))
    (var-set epoch new-epoch)
    (map-set admins { epoch: new-epoch, admin: (get candidate active) } true)
    (var-set recovery none)
    (var-set round (+ u1 (var-get round)))
    (var-set security-level level-standard)
    (print { a: "execute-recovery", payload: active })
    (ok true)))

;; init
(map-set admins { epoch: u0, admin: tx-sender } true)
