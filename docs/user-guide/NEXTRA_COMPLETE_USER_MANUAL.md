# Nextra Wholesale — Complete User Manual

> **Repository-based guide, reviewed 13 November 2026.** This describes the routes and controls found in the checked-out application. It is not a claim that the production environment has the same data or configuration. There is no app-wide workflow wizard. Pages require a configured database, signed-in staff and, for uploads/PDFs, the configured Cloudinary service.

## 1. Roles, entry points and limits

- Public buyers use `/` (storefront) and do not need an account to send a wholesale enquiry.
- Staff use `/login`. Successful `SUPER_ADMIN` sessions route to `/admin`; `SALES_EXECUTIVE` sessions route to `/sales`. Authentication is cookie/session based.
- Super Admin has the admin navigation and is required for executive creation/assignment, catalogue and inventory configuration, order approval/reservation, billing configuration and invoice/credit note issuance.
- Sales Executive has a restricted workspace. Lead APIs enforce ownership; quotation, order, warehouse and invoice APIs enforce the access policy they implement. A hidden button is not the only protection: restricted API actions return an authorization error.
- The schema defines other roles (`SALES_MANAGER`, `ACCOUNTS`, `INVENTORY`, `PURCHASE`, `HR_MANAGER`, `POS_CASHIER`, `EMPLOYEE`, `CUSTOMER`) but the current authenticated UI/navigation is for Super Admin and Sales Executive. Do not infer access for the other roles.

## 2. End-to-end workflow at a glance

1. Super Admin creates an active category and (optionally) collection, then product records and images. Public browsing shows active catalogue records. Set up initial warehouse stock in Inventory.
2. Buyer browses the public storefront and submits **Wholesale enquiry** with contact/privacy consents. The application creates a website lead; attached GST certificate is optional.
3. Super Admin reviews the lead in `/admin/leads`, reviews any secure document, records verification, sets priority/tags/stage, makes follow-ups and assigns an executive.
4. Executive signs in, works only assigned leads, records calls/notes/follow-ups, and progresses verification. Super Admin or the executive with ownership can convert an eligible lead to a Customer after checking/correcting conversion fields.
5. Executive (or Super Admin) opens customer and creates a quotation using active products with configured wholesale price. Executive uses catalogue price; Super Admin may override. Mark Sent, record buyer acceptance, then convert accepted quotation to a Sales Order.
6. Super Admin reviews order, chooses a warehouse, checks availability, and confirms. Confirmation reserves all required quantity atomically only if all lines are available; shortage means no partial reservation.
7. Warehouse operator (Super Admin or authorized assigned executive per warehouse endpoints) creates picking list, starts it, records picked amounts, completes, records package quantities and completes packing, then creates and confirms dispatch. Delivery events are updated against each dispatch.
8. Dispatch completion does **not** create an invoice. Super Admin opens `/admin/invoices` or the dispatch from warehouse/order detail, previews eligible confirmed dispatch, enters tax treatment/place of supply/state code, creates draft, checks it and issues it. Issue allocates number and creates a private PDF snapshot.
9. Super Admin records manual payments, reviews invoice/payment history, and can reverse a payment with a reason. Invoice cancellation is blocked if any payment record exists. Credit notes currently support item quantity credits.

## 3. Public storefront and wholesale enquiry

### Storefront pages

| Page | Route | What is usable |
|---|---|---|
| Storefront home | `/` | Public homepage and active product sections; category and collection links; enquiry launch points. |
| Products | `/products` | Public active product browsing/search. |
| Product detail | `/products/[id]` | Product view and enquiry trigger with that item preselected. |
| Categories | `/categories` | Active public categories. |
| Collections | `/collections` | Active public collections. |

Public browse does not expose wholesale prices as an authenticated pricing console. Product interest is optional and may be added through the enquiry form (maximum 20 distinct selections); initial quantity is 10 and each interest must be an integer at least 10. Product availability depends on active product and taxonomy records.

### Enquiry form

Open **Wholesale enquiry** from a storefront trigger. The form is a modal, not a standalone route. It sends `POST /api/leads` through the lead service. Website-created records default to source `WEBSITE`, stage `NEW`, priority `MEDIUM`; a server-generated reference number is returned. An idempotency key is sent to avoid a double-submit creating duplicate rows on retry. Duplicate detection is later reviewed in CRM; a duplicate is not necessarily rejected at submission.

| Visible field | Required | Accepted/input detail |
|---|---:|---|
| Business name | Yes | Non-empty text. |
| Business type | Yes | `Wholesaler`, `Retailer`, `Boutique`, `Distributor`, `Reseller`, `Other`. |
| GSTIN | No | Blank or 15-character GSTIN format. It is not required to submit. |
| Website | No | URL input. |
| Instagram / social media URL | No | URL input. |
| Buyer name | Yes | Non-empty text. |
| Mobile number | Yes | 7–15 digits; optional leading `+`, spaces, parentheses and hyphens. Example format only: `+91 98765 43210`. |
| WhatsApp number | No | Phone text. |
| Email | Yes | Email format. |
| Preferred contact method | Yes | Phone, WhatsApp, Email. |
| City, State, PIN code, Country | Yes | India PIN must be six digits beginning 1–9; other-country postal code follows the form's alphanumeric rule. Country defaults to India. |
| Business address | No | Text. |
| GST certificate | No | PDF/JPG/PNG up to 5 MB; uploaded to private storage and downloaded via authenticated route. |
| Product interest | No | Active products, distinct, max 20; integer quantity >= 10. |
| Estimated order value | No | Positive amount, up to two decimals. |
| Preferred payment mode | No | Bank transfer, UPI, Other, Not decided. |
| Delivery address, Additional notes | No | Text. |
| Privacy Policy/contact consent; information accuracy confirmation | Yes | Both consent and accuracy checkboxes must be checked. |

Success shows a toast and reference number, then closes/resets the form. Validation errors appear beside the fields; server/network failures show an error. GST file upload availability requires Cloudinary configuration. The certificate is marked not scanned by default; antivirus scanning is not implemented in this workflow.

**Example enquiry (synthetic test data only):** Silk Route Demo; Retailer; buyer Test Buyer; mobile `+91 98765 43210`; email `buyer@example.test`; preferred contact Phone; city Surat; state Gujarat; PIN `395007`; country India; consent and accuracy checked; optionally one active product at quantity 10. Use a format-valid fake GSTIN only if specifically testing that field; do not use a real business's tax number.

## 4. Staff authentication, dashboards and navigation

### Login and setup

- Login route: `/login`, fields in the `Staff sign in` modal are email and password. The login endpoint checks active user credentials and role; success redirects Super Admin to `/admin`, Sales Executive to `/sales`.
- Sales Executive setup route: `/setup-account?token=…`. The Super Admin creates an executive at `/admin/sales-executives`; the UI exposes an activation link/token for setup. The executive sets a password of 12–128 characters. Activation token expires after 24 hours. Email delivery/invitation delivery is **not** implemented; the activation URL must be conveyed by the operator in the current implementation. Treat token as secret.
- Initial Super Admin bootstrap endpoint/page is part of authentication code, but no public registration link is presented in the normal login workflow. Use the existing authorized setup procedure for the environment; do not expose bootstrap credentials.
- Logout is in the shell and returns to `/`.

### Dashboard status

`/admin` currently displays only the word “Dashboard”; there are no CRM, inventory or invoice dashboard cards there. `/sales` has usable lead overview cards: total assigned, new/assigned, awaiting follow-up, qualified, converted, and recently assigned leads. Admin workflow starts from sidebar.

### Useful sidebar paths

Admin groups: **Customer & Sales** (Leads `/admin/leads`, Lost Leads `/admin/leads/lost`, Sales Executives `/admin/sales-executives`, Customers `/admin/customers`, Quotations `/admin/quotations`, Sales Orders `/admin/orders`, Warehouse & Dispatch `/admin/warehouse/orders`); **Catalogue & Inventory** (Products `/admin/products`, Categories `/admin/categories`, Collections `/admin/collections`, Inventory `/admin/inventory`, Warehouses `/admin/warehouse`); **Purchasing & Billing** (Invoices `/admin/invoices`, Credit Notes `/admin/credit-notes`); **Administration** (Settings `/admin/settings`, Company Profile `/admin/settings/company`, GST Configuration `/admin/settings/gst`, HSN/SAC `/admin/settings/hsn`, Product Tax Mapping `/admin/settings/product-tax`, Financial Year & Numbering `/admin/settings/financial-year`, Charges & Rounding `/admin/settings/charges`).

Sidebar labels for Suppliers, Purchase Orders, Goods Receipt, Payments, POS, HRMS, Attendance, Leave, Payroll, Expenses, Finance, Reports, Users & Access and Audit Logs exist but corresponding pages were not found in `src/app`; mark these **NOT IMPLEMENTED** despite the visible links.

Sales sidebar: Dashboard `/sales`; My Leads `/sales/leads`; My Lost Leads `/sales/leads/lost`; My Customers `/sales/customers`; My Quotations `/sales/quotations`; My Orders `/sales/orders`; Warehouse & Dispatch `/sales/warehouse/orders`; Invoices & Balances `/sales/invoices`; Credit Notes `/sales/credit-notes`.

## 5. Lead management (CRM)

### Lead list

- Super Admin: `/admin/leads`; Sales Executive: `/sales/leads` (owner-scoped). Open a row/reference to `/admin/leads/[id]` or `/sales/leads/[id]`.
- Search business, buyer, phone, email or reference. Filters include source, priority, stage, created date/age, state, city, follow-up, tag, product interest, verification status, duplicate status, assigned/unassigned and executive; sort/direction and pagination are available. Admin also has bulk actions Assign, Priority, Stage, Add tag, Remove tag. Source options correspond to schema (`WEBSITE`, `WHATSAPP`, `MANUAL`, `PHONE`, `SOCIAL_CAMPAIGN`, `REFERRAL`, `WALK_IN`, `EXISTING_CUSTOMER`, `IMPORT`).
- Lead stages in schema: `NEW`, `ASSIGNED`, `CONTACT_ATTEMPTED`, `CONTACTED`, `VERIFICATION_PENDING`, `QUALIFIED`, `QUOTATION_ORDER_DISCUSSION`, `CONVERTED`, `LOST`, `ON_HOLD`. Priorities: `LOW`, `MEDIUM`, legacy `NORMAL`, `HIGH`, `URGENT`. Lead list may label these in title case.

### Lead details and available operation groups

Open the lead detail. It shows business/contact/location, product interests, source/reference/stage/priority, consents, document list and secure download, duplicate candidates, verification checklist, assigned executive, activity history, notes and follow-ups. The exact controls displayed depend on stage, role and record. Use the actions below; save/update requests go to lead-specific API routes.

- **Assign/reassign** (Super Admin): choose active Sales Executive and submit. Assignment actor, prior assignee and timestamp are recorded. Executive sees the lead only once assigned; ownership is enforced server-side.
- **Stage / priority / tags**: set a schema stage and priority; enter a tag name to add, remove existing tags from chips. Bulk changes are also available from Admin list.
- **Activities**: record activity type (`PHONE_CALL`, `WHATSAPP`, `EMAIL`, `MEETING`, `NOTE` and workflow event types), required contact note/description, optional outcome and contact-made indicator. Activities are audit/history entries; the app does not send email/WhatsApp or place calls.
- **Follow-up**: create with due date/time and required note, assigned to an executive. Status values `PENDING`, `COMPLETED`, `CANCELLED`; complete/cancel from follow-up controls and inspect history.
- **Verification**: five check types: `BUSINESS_DETAILS`, `CONTACT_DETAILS`, `GST_CERTIFICATE`, `GSTIN`, `BUSINESS_LEGITIMACY`; statuses `PENDING`, `VERIFIED`, `NEEDS_MORE_INFORMATION`, `NOT_APPLICABLE`; optional remarks. Buyer decision values `APPROVED`, `MORE_INFORMATION_REQUESTED`, `REJECTED`; rejection requires a decision note. Missing GST certificate is not automatically disqualifying: use Not Applicable or request info as appropriate.
- **Duplicate review**: matches have reasons/confidence (`HIGH`, `POSSIBLE`) and review status (`PENDING`, `CONFIRMED_DUPLICATE`, `DISMISSED`). Review candidate and record a note; merge flow asks which lead's fields prevail (`PRIMARY`/`SECONDARY`) and an explicit assignment decision. A merge preserves the merge snapshot/history; it is not a generic delete.
- **Mark lost**: choose one of `PRICE_TOO_HIGH`, `COMPETITOR_SELECTED`, `NO_RESPONSE`, `REQUIREMENT_CANCELLED`, `PAYMENT_ISSUE`, `PRODUCT_UNAVAILABLE`, `BUYER_NOT_INTERESTED`, `BUSINESS_NOT_VERIFIED`, `DUPLICATE_LEAD`, `OTHER`. Other requires notes. Competitor, price objection, reactivation due date, and follow-up can be collected. Lost history is available at `/admin/leads/lost` and `/sales/leads/lost` (owner-scoped).
- **Reactivate**: on a lost lead, supply required reason; optionally choose a reactivation stage and follow-up details. History shows each lost/reactivated cycle.
- **Convert**: open `Review customer details`; editable fields: Business name, Buyer name, Mobile, WhatsApp, Email, GSTIN, City, State, Pincode. Confirm conversion. It creates Customer with a generated customer code, links the original lead and records the actor; it does not delete the lead. Confirm business approval/verification before conversion operationally. The form is prefilled from lead data.

Document access route is authenticated (`/api/admin/leads/[id]/documents/[documentId]`). Stored file metadata includes document type/name, MIME type, size and scan state; uploader uploads optional GST file as `GST_CERTIFICATE`. Private storage requires working Cloudinary credentials.

## 6. Sales Executive management and access

At `/admin/sales-executives`, Super Admin enters **First name**, **Last name**, **Email**, **Mobile (optional)**. First/last names are max 80 characters and required; valid email required and unique. Creation makes an inactive `SALES_EXECUTIVE` plus random activation token with 24-hour expiry. Follow the displayed activation link; the executive sets a 12+ character password at `/setup-account?token=…`; then sign in at `/login`.

Assign using Admin Leads list or lead detail. Reassignment is supported and logged. The executive workspace includes owned leads/lost leads, owned customers/quotations/orders, warehouse queue and invoice/credit-note read views. Direct URL access to another owner's lead/customer/order/invoice is checked by APIs; expect 403/404-style denial according to route. Invoice draft/create/issue, payments, reversal, cancellation and credit-note issue are Super Admin only.

## 7. Customer Master and conversion

There is no standalone create-customer form. Customer records are created by lead conversion. Admin route `/admin/customers`, sales route `/sales/customers`; search by code/business/buyer/phone, filter status, city, state, business type, conversion dates and executive, sort newest/oldest/business/code. Page sizes 10/20/50/100.

Customer fields inherited from lead include customer code (generated), business name/type, buyer, mobile, optional WhatsApp, email, optional GSTIN/website/social, business address, city/state/PIN/country, preferred contact/payment, delivery address; status defaults `ACTIVE`, assignment follows lead. On detail, see overview, original lead, interests/documents/verification/activity, quotations and executive. Super Admin can edit customer via `/admin/customers/[id]/edit` and change `ACTIVE`, `INACTIVE`, `BLOCKED`; executive sees owned customers read-only and can create quotations. No customer-delete control.

## 8. Product, category, collection and warehouse setup

### Categories and collections

Super Admin routes `/admin/categories`, `/admin/collections`. Add/Edit dialog: **Name** (required, max 120), **Description** optional, **Image upload** optional JPG/PNG/WEBP up to 10 MB, **Display order** (integer >=0), **Active** checkbox. Search, paging (10), edit, delete and image removal exist. Only active taxonomy is offered in product form and public browsing. Deletion may be rejected when linked products exist. Images are public storefront media (Cloudinary upload), unlike lead documents/invoice PDFs.

### Product management

Super Admin `/admin/products`; search name/SKU, filters category, collection, active/inactive. Add/Edit form fields:

| UI label | Required | Notes |
|---|---:|---|
| Product name | Yes | Non-empty. |
| SKU | Yes | Normalized uppercase; unique. |
| Wholesale Price (Per Piece) | Yes in current form | Positive amount up to 2 decimals. |
| Category | Yes | Select active category. |
| Collection | No | Select active collection. |
| Fabric, Colour, Work / design, Length | No | Product attributes. |
| Minimum order quantity | Read-only | Current product form fixes this value at 10; it is not editable in the form. |
| Pack size | No | Display/pack attribute. |
| Display order | No | Ordering value. |
| Short description, Full description | No | Storefront copy. |
| Active, Featured, New arrival | Checkboxes | Inactive products cannot be newly selected in public/quotation form; featured/new flags affect storefront placement. |
| Product images | Optional | JPG/PNG/WEBP, max 10 MB each, max 12 images; arrange order, designate primary, alt text. |

Product tax is configured separately. Product form does not directly capture HSN/SAC. Use `/admin/settings/product-tax` after creating HSN/rate data. Public pages expose active product names, descriptions, attributes/images; quotation-only wholesale price is served to signed-in workspace. Product stock comes from Inventory, not the product form. Price history route: `/admin/products/[id]/price-history`.

### Warehouses and inventory

Super Admin `/admin/warehouse` creates/edits warehouse. Fields from schema/UI: name, code (unique), optional description, address, city, state, PIN, contact person, contact phone, active. Confirm exact required markers in form; code/name must be unique/nonblank. `/admin/inventory` shows balances, search product/SKU, warehouse filter, optionally show zero balances, ledger, transfer history. Stock movement dialogs:

- **Stock in:** Product, Warehouse, Quantity positive integer, optional Reorder level, optional Reason, optional Reference, optional Notes.
- **Stock out:** Product, Warehouse, Quantity positive integer, required reason (min 2), optional Reference/Notes; cannot take unavailable stock.
- **Adjustment:** Product, Warehouse, Quantity difference positive integer, direction Increase/Decrease, required reason, optional Reference/Notes.
- **Transfer stock:** Product, From warehouse, To warehouse (different), positive integer Quantity, optional Reference/Notes; review before transfer. Available stock only is transferable.

`available = quantityOnHand - quantityReserved - quantityBlocked`. The UI shows on-hand/reserved/blocked/available; blocked quantity has no standalone adjustment dialog documented here. Stock ledger records movements. Opening balances should be entered using Stock in before order approval.

## 9. Quotations

Routes: list `/admin/quotations` or `/sales/quotations`; create `/admin/quotations/create` or `/sales/quotations/create`; detail `…/quotations/[id]`; edit `…/quotations/[id]/edit`. Customer detail also has **Create quotation**. Current role scope is Super Admin and Sales Executive; executive access is ownership-limited.

Create fields: Customer (select active assigned customer; inactive customer requires Super Admin confirmation checkbox), Valid until (date, today or future), at least one line with active Product, Quantity (integer; at/above product MOQ), Unit price / piece (auto-loaded wholesale price; read-only for executive, editable for Super Admin), Line discount (amount), overall discount type (`FIXED` or `PERCENT`), overall discount, Payment terms, Delivery terms, Customer notes, Internal notes. Remove/Add product line. New product lines load current wholesale price. Existing copied quotation lines retain their historical quote price. Taxes on the quotation are currently zero in the create screen; GST invoice is recalculated later from billing/product tax configuration. Do not treat quote totals as final tax invoice totals.

Save draft generates quotation reference, snapshots names/SKUs/catalog prices and amounts. Detail shows item table, totals, customer, terms and revisions. Actions: **Edit draft**, **Mark sent**, **Record accepted**, **Record rejected** (reason), **Cancel** (reason), **Create revision**, **Print / Save PDF**, **Convert to Sales Order** (accepted only). Mark Sent is a recorded workflow state; no email delivery/share integration is present. Revision creates a new linked quotation. Validity date is captured; no automatic email expiry job is evidenced, so check status/expiry behavior before relying on automatic `EXPIRED` changes. Sales Order eligibility requires `ACCEPTED` quotation and duplicate conversion is prevented by unique relation.

## 10. Sales orders and approval/reservation

List `/admin/orders` / `/sales/orders`; detail `/admin/orders/[id]` / `/sales/orders/[id]`. Create through accepted quotation detail **Convert to Sales Order**. Order number is server-generated; customer/quotation/items/prices/discount/totals are copied snapshots. The order captures delivery address, instructions and notes from conversion/available data; order items are not an independent freeform create form.

Super Admin selects **Warehouse for approval reservation**, clicks availability check, reviews each required/available/short quantity, then confirms/approves. Confirmation reserves all lines as a unit if every line has enough available stock. Shortage does not reserve partial stock and produces shortage history. Other order actions depend on current status; UI includes hold, reject and cancel with reasons. Status enum: `DRAFT`, `AWAITING_APPROVAL`, `CONFIRMED`, `ON_HOLD`, `REJECTED`, `CANCELLED`. Inspect order events and reservation history on detail. Executive can see owned order and warehouse operations as access policy allows; approval/reservation is Super Admin-only.

Reservation is reflected in StockBalance (`quantityReserved`), not a physical stock movement. Warehouse queue only includes confirmed orders with active reservations.

## 11. Warehouse, picking, packing and dispatch

Routes: admin `/admin/warehouse/orders`, detail `/admin/warehouse/orders/[id]`; executive `/sales/warehouse/orders`, detail `/sales/warehouse/orders/[id]`. Admin warehouse setup `/admin/warehouse`.

1. Queue rows show order/customer/date/quantity/warehouse/picking/packing/delivery. Open order. Warehouse comes from active reservation; there is no separate warehouse selector in picking.
2. **Create picking list** creates one list for order. **Start picking** moves `NOT_STARTED` → `IN_PROGRESS`. Per line enter picked quantity from 0 to reserved; **Save picked qty**. If less than reserved, enter discrepancy reason. **Complete picking** finalizes; statuses `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`.
3. After complete, enter quantities to pack (up to picked remaining); **Create and complete package** prompts optional package description and creates one package for these lines. Packing may be recorded in multiple batches; package number is generated. Model supports optional package weight, but current UI does not expose weight. Status `IN_PROGRESS`/`COMPLETED`.
4. Enter optional **Transport / courier name**, **Tracking / consignment number**, choose quantities from completed packages (not previously dispatched), then **Create and confirm dispatch**. UI sends packageCount 1, items; reference is generated. A dispatch is confirmed and inventory is consumed/released by backend. Dispatch list shows reference/status/delivery status/courier/tracking/quantity and event timeline.
5. Delivery selector options: `DISPATCHED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED`, `RETURNED` (excluding current status and not-dispatched). Failure prompts reason. Each status update records a delivery event; delivered/returned entries stop offering further updates.

**Partial dispatch:** quantities can be dispatched up to the remaining packed amount. Confirm a 60-piece dispatch from packed 100; later pack/dispatch the remaining 40. Each confirmed dispatch is separate and can be invoiced once. Do not try to invoice un-dispatched or un-packed quantities.

## 12. Billing setup (Super Admin)

Open `/admin/settings` and settings tabs. The billing settings intentionally leave legal/tax values blank; enter real values only after business/accountant approval. There is no safe generic GSTIN, PAN, GST rate, or HSN example to copy.

| Page/route | UI and purpose |
|---|---|
| Company Profile `/admin/settings/company` | Registered legal business name, Trade name, Logo URL, Invoice header name, Registered address, Registered state, State code, PIN code, Country, Contact number, Official email, PAN, GSTIN, Business registration details, Default place of supply, Freight label, Packing label, Bank/payment details, Footer notes, Terms and conditions, Rounding precision (0–4), Rounding method (`HALF_UP`, `HALF_EVEN`, `DOWN`, `UP`). PAN/GSTIN format is validated when supplied; issue readiness also requires configured company fields. Logo rendering only supports trusted Cloudinary HTTPS URL. |
| GST Configuration `/admin/settings/gst` | GST rate records, including code/name/rate/effective dates and active status. Exact active options depend on configured records. Do not invent rates; accountant confirms tax applicability and effective dates. |
| HSN / SAC Master `/admin/settings/hsn` | Add/edit HSN/SAC code, description and active/default rate association as exposed by page. Codes and rates must be supplied/confirmed by accountant. |
| Product Tax Mapping `/admin/settings/product-tax` | Per product choose active HSN/SAC and optional active GST rate (or use HSN rate/no mapping); Tax-inclusive wholesale price checkbox; Tax UOM; Save. A product without resolvable tax mapping may fail invoice preview/issue. |
| Financial Year `/admin/settings/financial-year` | Create/activate date-range financial year. Configure one active year before allocating invoice/credit note numbers. The numbering service uses applicable active FY. |
| Financial Year & Numbering `/admin/settings/numbering` | Configure document type, prefix/format, sequence/start and optional branch behavior as available; active config is needed to issue. Types in schema: `TAX_INVOICE`, `PROFORMA_INVOICE`, `DELIVERY_CHALLAN`, `CREDIT_NOTE`, `DEBIT_NOTE`. Invoice numbering can include warehouse branch code; exact result depends on saved config and branch code. |
| Charges & Rounding `/admin/settings/charges` | Configure charge code/label, taxable flag, tax-inclusive flag/rate and active state; invoice draft accepts configured charge amount(s). Rounding precision/method is on company settings. Discount is captured on quote/order; no separate discount settings page is present. |
| Tax preview `/admin/settings/tax-preview` | Enter Sales Order ID; choose Intra-state (CGST + SGST) or Inter-state (IGST); click **Calculate preview**. Preview only, not invoice issue. Use POS rules only after accountant confirmation. |

Warehouse setup and stock-in must also precede order approval. Cloudinary is needed for private GST document storage and private invoice PDFs. Payment modes are fixed in UI: Cash, UPI, Bank Transfer, Card, Other; there is no gateway configuration.

## 13. Invoice generation and lifecycle (Super Admin only)

Invoice issuance, payment recording/reversal, cancellation, PDF regeneration and credit-note issuance are restricted to `SUPER_ADMIN`. Sales can view only invoices in their authorized customer/order scope. Invoice generation is manual, never automatic after dispatch.

### Eligible dispatch → draft → issued

1. Open `/admin/invoices` and review **Confirmed dispatches ready to invoice** or open order/warehouse detail and use **Generate invoice** for a confirmed dispatch. Only confirmed, not-yet-invoiced dispatches appear.
2. Open the preview. Verify customer and ship-to snapshot; order/dispatch; item name/SKU/HSN/UOM; ordered, dispatched, previously invoiced, invoiceable and remaining quantities; unit price and discount; GST mapping; line totals and tax summary.
3. Enter **Supply treatment** (`INTRA_STATE` or `INTER_STATE`), **Place of supply**, two-character **State code**, optionally check **Reverse charge**, enter configured charge amounts if applicable. Review preview. These are operator decisions; app does not infer legal place-of-supply treatment.
4. Click **Create invoice draft**. This creates one draft for that dispatch. On detail, update Tax treatment, Place of supply, State code, optional Due date, Reverse charge and configured charge amounts using **Save draft**. Check all snapshots/totals and company configuration.
5. Click **Issue invoice**. Backend verifies required company/customer/tax fields and allocates next number using active FY and numbering config, stores immutable invoice snapshot, generates PDF, records issuer/event and private document version. Invoice statuses: `DRAFT`, `ISSUED`, `CREDIT_NOTED`, `CANCELLED`. Payment statuses: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`.
6. One unique invoice per dispatch prevents duplicate issuance. The invoiceable quantity is the actual dispatched quantity minus prior invoice/credit-related quantities in the applicable logic. An order with multiple partial dispatches gets one invoice per confirmed dispatch.

### Partial dispatch quantity example

Order 100 pieces → pick/pack → confirm dispatch 1 of 60 → create/issue invoice for that dispatch (60). Pack/dispatch remaining 40 later → create/issue invoice for dispatch 2 (40). Dispatch 1 cannot be invoiced twice; an undispatched 40 cannot be included on invoice 1. Example is quantity-only; actual amounts depend on price snapshots, configured discounts and accountant-approved tax setup.

### PDF, history, payments and cancellation

- Invoice list `/admin/invoices` includes search invoice/order/customer/dispatch, Customer ID, from/to date, sort by newest created/invoice date/due date/amount, invoice/payment status filters. Open invoice detail `/admin/invoices/[id]`.
- Buttons: **View PDF**, **Download PDF**, **Print**. Download uses an authenticated PDF endpoint; stored PDFs are private Cloudinary assets. **Regenerate PDF** requires a reason; it creates a new immutable document version from invoice snapshots, retains old asset/version and event history.
- Detail shows item rows, totals, company/customer snapshots, PDF versions and invoice timeline/payment/credit history.
- **Record manual payment** fields: Amount received (positive, <= outstanding), Payment date (date), Mode (`CASH`, `UPI`, `BANK_TRANSFER`, `CARD`, `OTHER`), optional Transaction reference, optional Bank / UPI details, optional Internal remarks. Record Payment updates paid/outstanding and payment status and logs actor. Partial payment leads `PARTIALLY_PAID`; full payment `PAID`; overdue is due-date based (verify current status on detail/list; no scheduled job evidenced).
- Reversal requires reason, records a reversal rather than deleting payment; balance/status are recalculated. Do not repeat successful payment submit; unique idempotency key guards a duplicate request.
- **Cancel invoice** prompts mandatory reason. Invoice with any payment record (even reversed history) is blocked. Invoice number/PDF/event history is retained.

### Credit notes

Admin `/admin/credit-notes`, detail `/admin/credit-notes/[id]`; sales routes are read-only scoped views `/sales/credit-notes`. From an issued invoice, enter reason and item credit quantities (bounded by invoiced quantity) and create draft; review and issue. Status: `DRAFT`, `ISSUED`, `CANCELLED`. Tax amounts derive from original invoice line snapshots. Credit notes support quantity-based item credits only: independent price/discount/tax/charge adjustment and credit-note PDF are not implemented. Issuing note updates credited/customer-credit/outstanding accounting values; do not treat customer-credit balance as a refund transaction—the application does not execute bank refunds.

## 14. Page-by-page quick reference

| Module | Role / navigation | Route | Main usable action |
|---|---|---|---|
| Public enquiry | Public → storefront | `/` modal | Submit enquiry; product/category pages link into it. |
| CRM leads | Admin → Customer & Sales → Leads | `/admin/leads`, `/admin/leads/[id]` | Review, verify, assign, activities, follow-ups, duplicate/lost/reactivate, convert. |
| Owned leads | Sales → My Leads | `/sales/leads`, `/sales/leads/[id]` | Follow-up and owned-lead work. |
| Executives | Admin → Sales Executives | `/admin/sales-executives` | Create and activate account. |
| Customers | Admin → Customers; Sales → My Customers | `/admin/customers`, `/sales/customers` | Search, detail/history; Admin edit/status. |
| Products/taxonomy | Admin → Catalogue & Inventory | `/admin/products`, `/admin/categories`, `/admin/collections` | Maintain catalogue and storefront visibility. |
| Inventory/warehouses | Admin → Catalogue & Inventory | `/admin/inventory`, `/admin/warehouse` | Balances, stock movements/transfers, warehouse records. |
| Quotations | Admin or Sales → Quotations | `/admin/quotations`, `/sales/quotations` | Draft, mark sent, record decision, revise, print, convert accepted quote. |
| Sales orders | Admin or Sales → Sales Orders/My Orders | `/admin/orders`, `/sales/orders` | View; Admin approval/reservation. |
| Warehouse | Admin/Sales → Warehouse & Dispatch | `/admin/warehouse/orders`, `/sales/warehouse/orders` | Pick, pack, dispatch, update delivery. |
| Billing configuration | Admin → Settings | `/admin/settings/*` | Company/tax/master/numbering/charges configuration. |
| Invoice creation | Super Admin → Invoices | `/admin/invoices` | Preview confirmed dispatch, draft, issue, PDF. |
| Invoice viewing | Authorized Admin/Sales | `/admin/invoices`, `/sales/invoices` | Scoped list/detail/PDF. |
| Payments / notes | Admin → Invoices/Credit Notes | `/admin/invoices/[id]`, `/admin/credit-notes` | Record/reverse payment, cancel, create/issue credit note. |

## 15. Incomplete or absent functionality

- Admin dashboard is a placeholder; no reports or summary tiles.
- Sidebar links without page routes: Suppliers, Purchase Orders, Goods Receipt, Payments (separate page), POS, HRMS, Attendance, Leave, Payroll, Expenses, Finance, Reports, Users & Access, Audit Logs. No customer self-service account flow is evidenced.
- Executive invitation is not email-delivered. Activation token handling requires an operator to provide the URL.
- No external communication (email/WhatsApp), payment gateway, antivirus scanning, automated dispatch-to-invoice, scheduled overdue task, or automatic lead/quotation notification is evidenced.
- Quotation tax is currently zero; invoice uses separate billing configuration. Quote PDF is browser print/save, not generated/stored server-side.
- Picking discrepancy does not expose an operator resolution workflow beyond note and quantity. Packing UI creates one package per action and does not capture weight.
- Credit note scope is quantity based and there is no credit note PDF.
- No database seed scripts are relied on by this guide. The checked-out repository does not include a current environment/production data inventory. Existing credentials, user records, tax records, Cloudinary config and applied migrations must be confirmed in the target environment.

## 16. Prerequisites and safe test guidance

Before attempting full E2E, have authorized test Super Admin credentials, active migrations/client matching this checkout, reachable PostgreSQL, Cloudinary credentials for document/PDF paths, at least one active warehouse, active category and product, stock-in quantity, and approved company/GST/HSN/product-tax/FY/numbering/charge configuration. Use accountant-approved tax data; use clearly synthetic buyer data and never invent a real GSTIN/PAN. Create a Sales Executive with a test mailbox and a safe activation-token handoff. Add product and stock before attempting quote/order/dispatch. See `NEXTRA_TEST_DATA_PREPARATION.md` and `NEXTRA_END_TO_END_TEST_CHECKLIST.md` alongside this manual.
