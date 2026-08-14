-- Quotes/estimates: a cart that's saved for a customer without touching
-- inventory at all (no stock_movements, no payment) -- just a snapshot of
-- items/prices at quoting time. Reuses the existing orders/order_lines
-- tables (status = 'quote') rather than a parallel schema, so the same
-- staff/RLS/reporting model applies for free; reports.ts already only sums
-- status = 'completed', so quotes (converted or not) never pollute revenue.
--
-- converted_order_id marks whether a quote became a real sale and which
-- one -- set by submitSale (best-effort, via the service-role client) when
-- checkout is reached via /checkout?fromQuote=<id>. The quote row itself is
-- never deleted on conversion, only when a cashier explicitly discards an
-- unconverted one.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in ('completed', 'voided', 'quote'));

alter table orders add column customer_name text;
alter table orders add column converted_order_id uuid references orders(id);
