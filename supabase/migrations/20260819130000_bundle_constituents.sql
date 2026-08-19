-- Persists the actual-as-sold constituent list for a bundle order line, so
-- refund/warranty-replace/exchange can later replay exactly what was
-- actually taken from stock instead of re-deriving from the bundle's recipe
-- (which would be wrong the moment a part was skipped or swapped for a
-- different item -- see checkout.ts/orders.ts). Always populated for a
-- bundle line, even when nothing was customized (just a copy of the
-- recipe), so downstream code has one source of truth and never needs a
-- "recompute from the recipe" fallback. Null for plain-item lines.
alter table order_lines add column is_bundle boolean not null default false;
alter table order_lines add column bundle_constituents jsonb;
