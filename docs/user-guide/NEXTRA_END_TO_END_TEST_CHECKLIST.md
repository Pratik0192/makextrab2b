# Nextra Wholesale — End-to-End Test Checklist

> Run in a non-production environment using synthetic buyer data. Use accountant-approved company/tax configuration only. Do not enter real passwords, GSTIN, PAN, payment details or customer data in test notes. The expected path below follows the currently implemented UI.

## 0. Test environment and prerequisites

- [ ] Confirm this is a non-production application/database.
- [ ] Confirm the environment owner has applied the matching Prisma migrations and generated the Prisma client. Do not run migrations as part of this manual test unless separately authorized.
- [ ] Confirm PostgreSQL connectivity and that the app is running.
- [ ] Confirm authorized Super Admin login works.
- [ ] Confirm Cloudinary configuration works for private lead document and invoice PDF storage.
- [ ] Confirm test Sales Executive email is available and activation URL can be securely handed off; activation token expires after 24 hours.
- [ ] Obtain actual company and tax setup values from the business/accountant. Never invent GST rates, HSN/SAC, PAN, GSTIN, treatment or place-of-supply decisions.
- [ ] Prepare synthetic scenario `E2E-SILK-001` from `NEXTRA_TEST_DATA_PREPARATION.md`.
- [ ] Keep generated record IDs/references in a private test worksheet.

## 1. Configure catalogue and warehouse stock (Super Admin)

- [ ] Sign in at `/login` as `SUPER_ADMIN`; verify redirection to `/admin`.
- [ ] Confirm `/admin` currently renders the basic Dashboard placeholder; use the sidebar for actual work.
- [ ] Open **Catalogue & Inventory → Categories** (`/admin/categories`). Add active category `E2E Test Sarees`; verify it appears in list.
- [ ] Optionally add active collection `E2E Test Collection` at `/admin/collections`; verify status and display order.
- [ ] Open `/admin/products`; add five synthetic products from the preparation sheet with unique uppercase SKUs, active status, chosen category and positive wholesale price/piece.
- [ ] Confirm MOQ values and any optional fabric/colour/work/length/pack size/display order/descriptions.
- [ ] Optionally upload safe JPG/PNG/WEBP product images under 10 MB each; verify primary image and ordering. Stay within 12 images per product.
- [ ] Verify product rows, category/collection filters, active status, wholesale price and MOQ.
- [ ] Open `/admin/warehouse`; create active `Test Surat Warehouse` with unique code `E2E-SUR`; capture generated ID.
- [ ] Open `/admin/inventory`; record Stock in for Products A/B/C: 120/80/75 pieces at Test Surat Warehouse. Use a reason/reference for traceability.
- [ ] Verify stock balances: on-hand 120/80/75, reserved 0, blocked 0, available 120/80/75.
- [ ] Open stock ledger and verify stock-in records appear with product, warehouse, quantity, actor and timestamp.
- [ ] (Optional) Test transfer between two active warehouses; confirm source/destination and paired ledger entries. This is not required for the main scenario.

## 2. Prepare billing prerequisites (Super Admin + accountant-approved values)

- [ ] Open `/admin/settings/company`; enter approved registered company name/address/state/state code/PIN/country/contact/email and applicable PAN/GSTIN. Add invoice terms/footer/bank details only if approved.
- [ ] Confirm rounding precision/method with finance; set only approved values.
- [ ] Open `/admin/settings/gst`; configure approved GST rate records and effective dates. Do not use guessed tax rates.
- [ ] Open `/admin/settings/hsn`; add/select accountant-approved HSN/SAC records and descriptions.
- [ ] Open `/admin/settings/product-tax`; map Products A/B/C to approved HSN/SAC and rate (or explicitly approved HSN rate fallback). Confirm tax-inclusive price setting and UOM for each.
- [ ] Open `/admin/settings/financial-year`; ensure correct active financial year exists.
- [ ] Open `/admin/settings/numbering`; verify active `TAX_INVOICE` numbering configuration and prefix/sequence/branch behavior approved by business.
- [ ] Open `/admin/settings/charges`; configure any required freight/packing/additional charges; otherwise leave inactive/unused. Confirm taxable/inclusive/rate flags.
- [ ] Open `/admin/settings/tax-preview`; run a preview on an eligible order when available. Confirm accountant-reviewed intra/inter treatment. This page is preview only.
- [ ] Verify Cloudinary PDF upload path once by issuing only a disposable test invoice after order/dispatch flow; do not configure a public PDF URL.

## 3. Create Sales Executive (Super Admin)

- [ ] Open **Customer & Sales → Sales Executives** (`/admin/sales-executives`).
- [ ] Create Test Executive / Executive, email `test.executive@example.test`, optional synthetic phone `+91 90000 00001`.
- [ ] Verify account appears inactive pending setup.
- [ ] Securely copy the activation URL/token out of app for the test user; do not place token in screenshots or committed documentation.
- [ ] Open `/setup-account?token=…`; set a test password of at least 12 characters.
- [ ] Verify activation success, then sign in at `/login` and verify `/sales` redirect and role label.
- [ ] Verify sales dashboard cards and “Recently assigned to you” are visible; no leads should appear before assignment.

## 4. Submit and review public enquiry

- [ ] Sign out or open a private browser session.
- [ ] Open `/`; verify public storefront and active product/category/collection sections load.
- [ ] Open `/products`, `/categories`, `/collections`; confirm only active catalogue entries appear.
- [ ] Open one product detail `/products/[id]`; launch wholesale enquiry and confirm product is preselected.
- [ ] Fill enquiry with `E2E-SILK-001` business/contact/location values. Required: business, business type, buyer, mobile, email, preferred contact, city/state/PIN/country, both consents and accuracy confirmation.
- [ ] Add A/B/C interests, quantities 40/30/30 (each >=10), or submit a general enquiry if testing product-interest omission separately.
- [ ] Leave GSTIN blank and GST certificate blank once; verify optionality. In a separate upload test, attach a synthetic PDF/JPG/PNG <=5 MB.
- [ ] Submit once; verify success toast and generated lead reference. Capture reference.
- [ ] Verify form resets/closes; check no duplicate was created by double-click/retry test only if intentionally testing idempotency.
- [ ] Sign in as Super Admin and open `/admin/leads`; search by reference/business/email. Verify source `WEBSITE`, stage initially `NEW`, priority initially `MEDIUM`, submitted details and interests.
- [ ] Open lead detail `/admin/leads/[id]`; verify secure document download (if uploaded) requires staff session.
- [ ] Confirm consent flags, source/reference, product interest and any document scan state are visible.

## 5. Lead review, assignment and follow-up

- [ ] On lead detail review business, buyer, contact, location, product interest and notes.
- [ ] If certificate absent, mark GST certificate `NOT_APPLICABLE` or leave unresolved based on test case; do not treat absence as upload failure.
- [ ] Record verification statuses/remarks for business details, contact details, GST certificate, GSTIN and legitimacy based on test evidence.
- [ ] Record buyer approval `APPROVED` for this synthetic buyer; verify rejection requires a decision note in a separate negative test.
- [ ] Set priority `HIGH`, add tag `E2E-SILK-001`, and advance through appropriate contact/verification/qualified stages as UI allows.
- [ ] Add activity type `PHONE_CALL`, contact note and outcome; verify it appears in activity timeline.
- [ ] Schedule a future follow-up with note; verify pending follow-up appears on lead detail/list.
- [ ] Assign Test Executive; verify assignment history/actor/time and ownership are updated.
- [ ] Verify executive dashboard and `/sales/leads` now list the lead.
- [ ] As Executive, open assigned lead; verify permitted activity/follow-up actions work.
- [ ] As a second executive (if available), try to open this lead by direct URL; verify access is denied/scoped.
- [ ] Run duplicate scenario with a second intentional submission using matching contact details. Review candidate in CRM, record dismissal or confirmed duplicate. Merge only disposable test records and verify merge history/field choice.
- [ ] Test mark-lost on a disposable lead: choose reason, complete required notes for `OTHER`; verify lost history at `/admin/leads/lost`.
- [ ] Reactivate disposable lost lead with required reason and optional follow-up; verify reactivation history.

## 6. Convert lead to customer

- [ ] From lead detail, click conversion action and review the customer details dialog.
- [ ] Verify editable conversion values prefill from lead. Correct test-only values if needed: Business name, Buyer name, Mobile, WhatsApp, Email, GSTIN, City, State, Pincode.
- [ ] Confirm conversion only after business/contact details are acceptable; capture generated customer code.
- [ ] Verify lead is retained and marked converted; Customer is created once and links to original lead and Test Executive.
- [ ] Open `/admin/customers`; search generated customer code/business name. Verify default status `ACTIVE` and customer contact/location data.
- [ ] Open customer detail and verify original lead, interests/documents/activity, assigned executive and sales order history.
- [ ] In a separate Admin test, edit customer or change status to `INACTIVE`, then restore `ACTIVE`; verify executives do not see edit/status controls.

## 7. Create a direct customer sales order

- [ ] Open customer detail **Create sales order**, or `/sales/orders/create` as the assigned executive.
- [ ] Verify the selected customer is active and assigned to the executive. Add Products A/B/C with quantities 40/30/30, wholesale prices 1200/850/700 and zero line discounts.
- [ ] Verify executive unit prices are read-only. As Super Admin, confirm price override is available without changing the main scenario prices.
- [ ] Try quantity below MOQ and verify server validation rejects it. Restore 40/30/30.
- [ ] Create draft; capture order number; verify customer, delivery details, line snapshots, totals and `DIRECT_CUSTOMER_ORDER_CREATED` activity.
- [ ] Verify no stock is reserved while the order is a draft.
- [ ] As Sales Executive, submit it for approval. Verify `AWAITING_APPROVAL` and the submission event.
- [ ] As Super Admin, reject a separate disposable test order and verify a reason is recorded. Keep the main order pending for the approval section.

## 8. Approve order and reserve inventory

- [ ] Open `/admin/orders`; find order and open details.
- [ ] Choose `Test Surat Warehouse` in **Warehouse for approval reservation**.
- [ ] Click availability check; verify required 40/30/30, available 120/80/75 and zero shortage.
- [ ] Confirm/approve order; verify status `CONFIRMED`, reservation history and quantities 40/30/30.
- [ ] Recheck inventory: on-hand remains 120/80/75; reserved 40/30/30; blocked 0; available 80/50/45.
- [ ] Open order in Sales workspace as owner; confirm read scope.
- [ ] In separate disposable order, reduce stock below one required line and attempt approval. Verify shortage is shown and no partial quantities are reserved.

## 9. Pick, pack and make two partial dispatches

- [ ] Open `/admin/warehouse/orders` (or authorized Sales warehouse queue); verify confirmed reserved order appears.
- [ ] Open order detail; create picking list; verify generated reference and `NOT_STARTED` status.
- [ ] Start picking; verify `IN_PROGRESS`.
- [ ] Enter A=40, B=30, C=30 picked; save each line and complete picking.
- [ ] In a disposable picking test, enter less than reserved; enter required discrepancy reason and verify it is recorded.
- [ ] Pack quantities for all three products. Create and complete package with description `E2E package 1`; verify package/picking status.
- [ ] Create/confirm Dispatch 1 with 24/18/18 pieces (60 total), courier `E2E Test Courier`, tracking `E2E-TRACK-001`.
- [ ] Verify generated dispatch reference, status `CONFIRMED`, quantities, delivery status, stock ledger and reservation history.
- [ ] Update delivery through `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`; verify each event and actor/time.
- [ ] Ensure 16/12/12 remains packed/dispatchable; if not yet packed, use picking remaining and a second packing action/package.
- [ ] Create/confirm Dispatch 2 with 16/12/12 pieces (40 total), tracking `E2E-TRACK-002`.
- [ ] Verify combined confirmed dispatch quantities equal order quantities exactly: A=40, B=30, C=30; no overdispatch.
- [ ] Do not expect automatic invoice creation after dispatch.

## 10. Configure/check tax and issue two invoices (Super Admin only)

- [ ] As Super Admin, confirm billing prerequisites still active: company details, approved GST rates, HSN/SAC, product mappings, financial year, tax-invoice numbering and optional charges.
- [ ] Open `/admin/invoices`; verify Dispatch 1 and Dispatch 2 appear under confirmed dispatches ready to invoice.
- [ ] Verify Sales Executive does not see invoice generation control; if direct API/security testing is authorized, verify create/issue endpoint rejects executive role.
- [ ] Open Generate invoice for Dispatch 1. Enter accountant-approved supply treatment, place of supply and state code; set reverse charge only as instructed; set charge amounts only if applicable.
- [ ] Inspect preview: invoiceable quantities A=24/B=18/C=18; verify unit prices, discounts, HSN and tax breakdown.
- [ ] Create invoice draft; open `/admin/invoices/[id]`; verify draft values and snapshots. Adjust due date if desired and save draft.
- [ ] Issue invoice. Verify generated invoice number, `ISSUED` status, issuer/time, private PDF and version 1 document history.
- [ ] Verify pre-tax taxable basis for test prices/no discount is ₹52,500. Compare tax and final total with accountant-approved calculation; do not assume rate values.
- [ ] Repeat for Dispatch 2. Verify quantities A=16/B=12/C=12 and pre-tax basis ₹42,000; issue and capture invoice number.
- [ ] Reopen Dispatch 1; verify it is no longer eligible and cannot receive a second invoice.
- [ ] Verify no undispatched quantity is offered for either dispatch invoice.

## 11. PDF, payment, history and credit note

- [ ] On each invoice, use View PDF and inspect seller/customer/ship-to, GSTIN if applicable, invoice number/date, POS/state code, HSN/UOM, quantities, line taxable values/tax components, totals, terms/bank/footer/page numbers.
- [ ] Download PDF through authenticated route; verify logged-out access is blocked. Print invoice and verify page breaks/legibility.
- [ ] If logo configured with Cloudinary HTTPS URL, verify logo; otherwise omission is expected.
- [ ] Record first partial payment on Invoice 1 (e.g. 40% of displayed grand total) with payment date, mode UPI, synthetic reference `E2E-RECEIPT-001`, no real account details.
- [ ] Verify payment history, amount paid, outstanding and `PARTIALLY_PAID` status.
- [ ] Record exact remaining outstanding; verify status `PAID`, outstanding zero after refresh.
- [ ] Verify duplicate submit/retry does not create a second payment record. Record entry count/reference for evidence.
- [ ] Reverse a disposable test payment with mandatory reason; verify reversal event and recalculated outstanding/status. Preserve reversal history.
- [ ] Attempt invoice cancellation after any payment record; verify blocked even if payment has been reversed.
- [ ] On an unpaid issued invoice (or disposable Invoice 2), create quantity-based credit note draft with reason and a bounded item quantity; verify original invoice tax snapshots are used.
- [ ] Issue credit note as Super Admin; verify number/status/history and invoice credit/outstanding/customer-credit values.
- [ ] Verify Sales Executive can view only authorized invoice/credit-note records; mutations are not exposed/authorized.
- [ ] If testing PDF regeneration, enter mandatory reason; verify new document version appears and previous version remains in history.

## 12. Final acceptance evidence

- [ ] Lead reference and source recorded.
- [ ] Assignment and executive owner verified.
- [ ] Customer code, lead linkage and conversion activity verified.
- [ ] Direct order customer/product/price snapshots and order activity verified.
- [ ] Sales Order reference/status and approval event verified.
- [ ] Reservation quantities and stock available calculations verified.
- [ ] Picking/packing references and any discrepancy notes verified.
- [ ] Two confirmed dispatch references total exactly 100 pieces; delivery history visible.
- [ ] Two invoice numbers match dispatches 1:1; quantities 60 and 40; no duplicates.
- [ ] PDF downloads are private and contents match invoice snapshots/accountant-reviewed tax calculation.
- [ ] Payment statuses/outstanding and credit note values verified.
- [ ] No production/customer/tax data was used; no passwords/tokens were included in evidence.
- [ ] Any unavailable route, missing prerequisite, unexpected validation or authorization result is recorded as a defect instead of bypassed.
