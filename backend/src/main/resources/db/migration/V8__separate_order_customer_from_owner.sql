ALTER TABLE orders RENAME COLUMN customer_id TO owner_id;
ALTER TABLE orders RENAME CONSTRAINT fk_orders_customer TO fk_orders_owner;
ALTER INDEX idx_orders_customer_created_at RENAME TO idx_orders_owner_created_at;
ALTER INDEX idx_orders_customer_status RENAME TO idx_orders_owner_status;

ALTER TABLE orders
    ADD COLUMN customer_name VARCHAR(120),
    ADD COLUMN customer_phone VARCHAR(11),
    ADD COLUMN customer_email VARCHAR(320);

CREATE INDEX idx_orders_owner_customer_name ON orders (owner_id, lower(customer_name));
CREATE INDEX idx_orders_owner_customer_email ON orders (owner_id, lower(customer_email));
CREATE INDEX idx_orders_owner_customer_phone ON orders (owner_id, customer_phone);
