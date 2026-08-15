-- customer_name already exists (added for quotes). Add a phone number
-- alongside it so a "Bill to" section can capture both, and so a warranty
-- or replacement inquiry can be looked up by phone/name later -- not just
-- by an exact receipt number nobody keeps.
alter table orders add column customer_phone text;
