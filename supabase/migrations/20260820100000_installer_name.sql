-- Tracks who physically installed the item(s) on a sale, distinct from the
-- cashier who rang it up (staff_id) -- matches the "Installer" field on the
-- shop's QuickBooks sales receipts. Internal-only, same as QuickBooks'
-- "Not printed on form" convention: shown in Orders, not on the customer
-- receipt.
alter table orders add column installer_name text;
