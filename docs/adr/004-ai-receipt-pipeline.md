# ADR 004: AI Receipt Verification Pipeline

## Context
Gyms in many countries operate heavily on cash. Members pay in cash, receive a paper receipt, but the gym owner may forget to log the payment. Members then upload their receipt photo as proof of payment. The system must verify the receipt is authentic and not a duplicate.

## Decision
Build a 5-step AI pipeline for received receipt images:

1. **OCR Extraction** — Extract amount, date, payer, payee, transaction ID, payment method
2. **Authenticity Check** — Detect edit marks, pixelation artifacts, verify EXIF data integrity
3. **Duplicate Detection** — Perceptual hash comparison against all prior receipts in this org
4. **Cross-Field Validation** — Amount matches known plan? Date within claim window? Gym name matches org?
5. **Confidence Scoring** — Aggregate all signals into a 0-100% score

## Decision Thresholds
- >= 95%: Auto-approve (5% random spot-audit)
- 70-94%: Admin review queue
- < 70%: Admin queue flagged suspicious

## Consequences
- Eliminates manual bottleneck for cash payment tracking
- Requires GPT-4o Vision or similar API access
- Perceptual hash database grows with each receipt
- Monthly threshold tuning needed based on reversal rate
