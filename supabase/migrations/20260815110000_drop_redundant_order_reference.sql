-- orders.inventory_reference was always going to equal orders.id itself --
-- the plan is to decide an order's id upfront (client-generated uuid) and
-- send that same id to inventory as the sale's externalReference, so the
-- order row IS the reference. A separate column just duplicated it. No data
-- has been written yet, so a plain drop is safe.
alter table orders drop column inventory_reference;
