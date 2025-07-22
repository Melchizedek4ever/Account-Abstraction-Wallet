;; title: smart-wallet-standard
;; version:
;; summary:
;; description:
(use-trait extension-trait .extension-trait.extension-trait)

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait sip-009-trait .sip-009-trait.nft-trait)
(use-trait sip-013-trait 'SPDBEG5X8XD50SPM1JJH0E5CTXGDV5NJTKAKKR5V.sip013-semi-fungible-token-trait.sip013-semi-fungible-token-trait)
;;(use-trait sip-013-trait .sip013-semi-fungible-token-trait.sip013-semi-fungible-token-trait)


(define-constant err-unauthorised (err u401))
(define-constant err-forbidden (err u403))

(define-read-only (is-admin-calling)
	(ok (asserts! (default-to false (map-get? admins contract-caller)) err-unauthorised))
)

(define-private (is-allowed-stx (amount uint) (recipient principal) (memo (optional (buff 34))))
	(is-admin-calling)
)

(define-private (is-allowed-extension (extension <extension-trait>) (payload (buff 2048)))
	(is-admin-calling)
)

(define-private (is-allowed-sip010 (sip010 <sip-010-trait>) (amount uint) (recipient principal) (memo (optional (buff 34))))
	(is-admin-calling)
)

(define-private (is-allowed-sip009 (sip009 <sip-009-trait>) (amount uint) (recipient principal))
	(is-admin-calling)
)

(define-private (is-allowed-sip013 (sip013 <sip-013-trait>) (amount uint) (recipient principal)) 
	(is-admin-calling)
)

;; calls with context switching

(define-public (stx-transfer (amount uint) (recipient principal) (memo (optional (buff 34))))
	(begin
		(try! (is-allowed-stx amount recipient memo))
		(as-contract (match memo
			to-print (stx-transfer-memo? amount tx-sender recipient to-print)
			(stx-transfer? amount tx-sender recipient)
		))
	)
)

(define-public (extension-call (extension <extension-trait>) (payload (buff 2048)))
	(begin
		(try! (is-allowed-extension extension payload))
		(as-contract (contract-call? extension call payload))
	)
)

;;
;; calls without context switching
;;

(define-public (sip010-transfer (amount uint) (recipient principal) (memo (optional (buff 34))) (sip010 <sip-010-trait>))
	(begin
		(try! (is-allowed-sip010 sip010 amount recipient memo))
		(contract-call? sip010 transfer amount (as-contract tx-sender) recipient memo)
	)
)

(define-public (sip009-transfer (nft-id uint) (recipient principal) (sip009 <sip-009-trait>))
	(begin
		(try! (is-allowed-sip009 sip009 nft-id recipient))
		(contract-call? sip009 transfer nft-id (as-contract tx-sender) recipient)
	)
)

;;(define-public (sip013-transfer (amount uint) (token-id uint) (sender principal) (recipient principal) (sip013 sip-013-trait)))
;;	(begin
;;		(is-allowed-sip013 sip013 token-id recipient)
;;		(asserts! (or (is-eq sender tx-sender) (is-eq sender contract-caller)) err-unauthorised)
;;		(try! (contract-call? sip013 transfer amount token-id (as-contract tx-sender) recipient))
;;		(print {type: "sft_transfer", token-id: token-id, amount: amount, sender: sender, recipient: recipient})
;;		(ok true)	
;;)

;;(define-public (transfer (token-id uint) (amount uint) (sender principal) (recipient principal) (sip013 <sip-013-trait>))
;;        (begin
;;    	(try! (is-allowed-sip013 sip013 token-id recipient))  
;;    	(asserts! (or (is-eq tx-sender recipient) (is-eq tx-sender contract-caller)) err-unauthorised)
;;    	(as-contract (contract-call? (ft-transfer? token-name amount sender recipient)) (ok true))
;;    	(print {type: "sft_transfer", token-id: token-id, sender: tx-sender, recipient: recipient, amount: amount})
;;    	(ok true))
;;  )

;;  (define-public (transfer (token-id uint) (amount uint) (sender principal) (recipient principal) (sip013 <sip-013-trait>))
;;  (begin
;;    ;; Step 1: Check if transfer is allowed
;;    (try! (is-allowed-sip013 sip013 token-id recipient))
;;    ;; Step 2: Authorization check
;;    (asserts! (or (is-eq tx-sender recipient) (is-eq tx-sender contract-caller)) err-unauthorised)
;;    ;; Step 3: Perform the transfer via contract call
;;    (unwrap! 
;;      (as-contract 
;;        (contract-call? .ft-token transfer amount sender recipient)
;;      )
;;      (err u400)
;;    )
;;    ;; Step 4: Log the event
;;    (print {type: "sft_transfer", token-id: token-id, sender: tx-sender, recipient: recipient, amount: amount})
;;    ;; Step 5: Return success
;;    (ok true)
;;  )
;;)


;;
;; admin functions
;;
(define-map admins principal bool)

(define-public (enable-admin (admin principal) (enabled bool))
	(begin
		(try! (is-admin-calling))
		(asserts! (not (is-eq admin contract-caller)) err-forbidden)
		(ok (map-set admins admin enabled))
	)
)

(define-public (transfer-wallet (new-admin principal))
	(begin
		(try! (is-admin-calling))
		(try! (enable-admin new-admin true))
		(map-set admins contract-caller false)
		(ok true)
	)
)

;; init
(map-set admins tx-sender true)
(map-set admins (as-contract tx-sender) true)
;; send 1000 ustx to the smart wallet
(stx-transfer? u1000 tx-sender (as-contract tx-sender))
