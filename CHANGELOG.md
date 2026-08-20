# Changelog

## 2026-08-20

### New: Made-to-order items no longer block checkout
- Items inventory marks as "allow selling past zero stock" (made-to-order goods) no longer show the "only X in stock" error in the cart — shows "Made to order" instead. The actual stock/oversell enforcement lives entirely on inventory's side (`fn_record_pos_sale`); this is just the cart no longer flagging something that isn't actually a problem. Verified with a real checkout end-to-end against a made-to-order test item, then voided.

### New: Installer / Technician on checkout
- Checkout now has an optional "Installer / Technician" field (who physically did the install, separate from the cashier who rang up the sale) — matches the "Installer" field already used on the shop's QuickBooks sales receipts. Shown in Orders for internal reference; not printed on the customer receipt, same convention as QuickBooks.

## 2026-08-19

### Fixed
- Removed "add reference later" for e-wallet/bank transfer payments (added earlier today) — for security, the reference number is required on the spot again to confirm the payment actually went through, not deferred to a follow-up step. No real transaction had used the deferred option.
- Connected Resend as a real email provider (Supabase → Authentication → SMTP Settings), replacing the default sender's low rate limit that was causing invite/reset emails to silently fail. Verified live: multiple resets in quick succession now go through cleanly instead of hitting "email rate limit exceeded." Note: Resend is still in sandbox mode (no verified domain yet), so real delivery is currently limited to the account's own registered address — inviting/resetting other staff won't actually land in their inbox until a domain is added.
- On an order line, clicking Refund/Warranty replace/Exchange while another of those was already open left both showing at once. Now opening one always closes whichever was open.

### New: Transaction counts on the payment method breakdown
- Analytics' payment method breakdown now shows how many transactions used each method, not just the revenue split — already responds to the Day/Week/Month/Quarter/Year period selector like the rest of the dashboard.

### New: Exchange
- Orders now has a third option alongside Refund and Warranty replace: **Exchange**, for when a defective item is swapped for a different (usually pricier) item instead of a straight refund or a free like-for-like replacement. Search for the new item, and the price difference is calculated automatically — the customer pays more, is owed money back on a downgrade, or nothing changes hands on an even swap. One record shows both the original and new item together on the order, instead of a disconnected refund + a brand-new sale.

### New: Checkout — discounts, split payments, card fee & installments
- **Discounts**: apply a % or ₱ discount at checkout for a special event/promo, with a reason and manager PIN (same authorization as void/refund). Shows on the receipt and in a new Discounts section on the Analytics page.
- **Split payments**: a sale can now be paid with more than one method at once (e.g. Cash + E-wallet) instead of forcing everything through a single tender.
- **Card processing fee**: a 3% fee is calculated automatically on any card payment and itemized separately on the receipt, on top of the sale total (not folded into it).
- **Card installments**: a card payment can be split into 3, 6, or 12 months, with the even monthly breakdown shown on the receipt (no store-added interest).

### New: Print & email receipts
- Any order in Orders (not just one just rung up) can now show its receipt again, with a "Print" button that prints just the receipt — no menu, buttons, or the rest of the page in the printout.
- Added "Email to" on the same receipt view — sends a copy to any email address via Resend. Note: Resend is still in sandbox mode (no verified domain yet), so real delivery is currently limited to the account's own registered address — emailing a real customer won't land in their inbox until a domain is added.

### New: Customizable bundles
- A bundle in the cart now shows its actual parts and lets you edit them before completing the sale — remove one that isn't needed (e.g. speaker foam when a car already has it built in), or swap one for a different item (e.g. no JBL in stock, sell MB Quart instead). The bundle's price to the customer never changes; only what actually gets taken out of inventory does. Refund, warranty replacement, and exchange on a customized bundle now correctly restock exactly what was actually sold, not the bundle's standard recipe.

## 2026-08-18

### Display & UX
- Item descriptions are now click-to-expand, same as Inventory.
- Currency switched to ₱ (Philippine pesos).
- Category filtering changed from pill buttons to a dropdown (Checkout/Quotes, then Catalog).
- Catalog page is now paginated (20 per page), matching Inventory's Items treatment.
- Header and Analytics dashboard made mobile-friendly.
- Staff page's "Add staff member" card widened so the schedule editor's time fields no longer wrap awkwardly.

### Staff scheduling & shift management
- Added weekly recurring schedules per staff member, settable when adding staff or editable afterward.
- Added a "shift ending soon" popup for clocked-in cashiers, based on their schedule.
- Revamped Clock In/Out into a single control: clicking "Clock out" confirms and signs out together; a "Clock in?" prompt appears after login if not yet clocked in.
- The "Clock in?" prompt's Dismiss option is now hidden for cashiers — they must clock in to proceed. Managers/admins can still dismiss it.

### Staff account management
- Adding a cashier/manager now sends a real invite email instead of setting a temporary password — they set their own password on first login.
- Added a "Forgot password?" self-service reset link on the login page.
- Added permanent staff-account deletion, gated on the account being deactivated first. Deleting an active account, or one with real order/shift history attached, is blocked with a clear explanation instead of failing silently.
- Added a plain Log out button for managers/admins in the header — previously the only way to sign out was via "Close cashier" on the Clock In/Out button, which forced them through a fake clock-in cycle. Cashiers still sign out exclusively via Close cashier, tied to ending their shift.

### Fixed
- A production outage (`ERR_TOO_MANY_REDIRECTS`) caused by a database permission gap on the newly added staff schedule column — real logins were failing invisibly. Fixed at the database level.
- The "Create the manager account" link on the login page was showing even after real staff already existed; now correctly hidden once staff exist.
- "Forgot password?" failed with a PKCE "code verifier not found" error whenever the reset link was opened on a different browser or device than the one that requested it (the normal case — e.g. requesting on desktop, opening the email on a phone). The server's Supabase client was defaulting to PKCE flow; switched to implicit flow, which this app needs anyway since it has no OAuth sign-in.

### Known issue
- The project's default Supabase email sender has a low rate limit; hitting it surfaces as "email rate limit exceeded" on invites/resets. Not urgent — resolves on its own within about an hour, or can be removed permanently by connecting a real email provider (e.g. Resend).
