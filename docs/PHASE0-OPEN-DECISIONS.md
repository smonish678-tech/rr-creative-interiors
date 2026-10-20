 # RR Creative Interiors — Phase 0 decisions required before production use

This is a blocker list. The application must not guess contractual, tax, payment or warranty terms.

## Supplied files and exact places to review

1. **RRCI Booking form.docx — page 2, clause 1(e)–(f):** delivery within 45 working days subject to signed design/specification, requisite advance and no scope changes; then a 15-working-day grace period. Confirm this is still the approved customer-facing promise and exactly when the clock starts.
2. **RRCI Booking form.docx — page 2, clause 4(a)–(b):** payment terms state 10% at booking and 40% at design finalisation, then 50% when manufactured goods are ready for shipment. Confirm this schedule is current.
3. **RRCI WC.docx — page 1, clause 2(b):** works contract says 50% advance to start manufacturing and 50% when manufactured goods are ready for shipment. This conflicts with the booking form. Replace only after the approved schedule is confirmed.
4. **RRCI WC.docx — page 2, clause 4:** delivery within 45 days, subject to signed design/quote, advance payment and site readiness. Confirm whether this means working days and reconcile with the booking form's grace-period clause.
5. **RRCI WC.docx — page 2, clause 5(b)–(d), and page 3, clauses 5(d)(i)–(ii):** five-year joinery warranty from invoice date; third-party products follow manufacturer terms; accessory warranty described as lifetime on a back-to-back basis. Confirm current policy and whether the exact phrase “lifetime warranty” is supportable in supplier terms.
6. **RRCI WC.docx — page 3, clause 8:** another 15-day grace period. Align this with the booking form and define how client-caused site delays affect the committed date.
7. **RRCI WC.docx — page 3, clause 9(b):** liability text says “refund of client’s entire amount actually paid to MYGUBBI.” This appears to name a different business and must be corrected by legal review before reuse.
8. **RRCI Booking form.docx — page 2, clause 3(a):** payments are described as payable to “Creative home interiors,” not consistently RR Creative Interiors. Confirm the legal receiving name and banking details.
9. **RR NEW Quote Formet July-26 - Copy.xlsx — sheet “Estimate”, cell F59:** the children’s bedroom summary amount formula is literally `#REF!`. Rebuild the formula from the correct children’s-bedroom total cell/range; do not guess the intended source. Check the room summary cells F53, F56, F59, F62, F65 and F68 against the detailed room totals and overall total in F89.
10. **RR NEW Quote Formet July-26 - Copy.xlsx — sheet “Estimate”, cell B94 and rows 260–264:** B94 says 10% / 60% / 20% / 10%. F260:F263 encode 0.10 / 0.60 / 0.20 / 0.10 and H260:H263 calculate those amounts from F89. Row 264 introduces a fifth 5% handover payment (F264=0.05) but H264 uses `=F89*0`, so its displayed amount is zero. Decide whether row 264 is removed, or whether an approved existing milestone is split to create a 5% handover amount. Do not simply add 5%: that would make the schedule total 105%. Check the actual total in F89 after fixing F59.
11. **Warranty Certificate.xlsx — sheet “Sheet1”:** remove the prefilled customer-specific data before using it as a master: G10 (date), E15 (customer name), E27 (phone), E33 (customer address), E39 (project address), E45 (scope of work), C62 (client name repeated in sign-off) and A63 (address repeated in footer). Keep labels/layout and populate these fields from the selected Project Passport.
12. **Mrs.Lakshmi Warranty Letter..pdf — page 1:** this is a customer-specific issued example, not a blank template. Preserve as an example only; don't use its customer data as a template default.
13. **Invoice - 52 Design Cubes.pdf — page 1, item row and totals block:** the line item displays ₹1,69,492 taxable value and ₹30,508 GST, while the totals block displays ₹1,69,491.50 subtotal and CGST/SGST ₹15,254.24 each (₹30,508.48 combined). Confirm the intended rounding/round-off treatment with the CA so the line, taxable subtotal, GST, grand total and amount-in-words reconcile. Keep bill-to/ship-to, GSTIN, invoice number/date, HSN/SAC, received and balance fields in the approved master.

## Decisions needed from RR owner + CA/legal reviewer

- [ ] Approved milestone schedule by service/project type, including whether any milestone can be waived.
- [ ] Delivery clock start date, working-day calendar, grace period and pause/restart rules.
- [ ] Current legal entity/receiving name, registered address, GSTIN and bank details.
- [ ] CA-approved tax invoice, advance receipt/voucher, refund/credit note and invoice-numbering rules.
- [ ] Approved joinery/accessory/third-party warranty coverage and start/end date rules.
- [ ] Legal-approved works contract, cancellation clause, change-order wording and e-signature process.
- [ ] Customer data retention/access policy and named admin/staff roles.
- [ ] Approved project code and document number formats.

## Technical prerequisite

Create/connect a Neon PostgreSQL database and set DATABASE_URL in Vercel Preview first. Apply db/migrations/001_operations.sql; verify /api/admin/operations/health returns ready before entering real customer or financial data. Do not enable Production until the same migration and environment are set in Production and a restore test passes.
