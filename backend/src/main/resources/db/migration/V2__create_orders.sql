CREATE TABLE orders (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    delivery_street VARCHAR(160) NOT NULL,
    delivery_number VARCHAR(30) NOT NULL,
    delivery_complement VARCHAR(120),
    delivery_neighborhood VARCHAR(120) NOT NULL,
    delivery_city VARCHAR(120) NOT NULL,
    delivery_state VARCHAR(2) NOT NULL,
    delivery_postal_code VARCHAR(16) NOT NULL,
    total_amount NUMERIC(19, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users (id),
    CONSTRAINT ck_orders_status CHECK (status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO')),
    CONSTRAINT ck_orders_total_amount CHECK (total_amount > 0)
);

CREATE INDEX idx_orders_customer_created_at ON orders (customer_id, created_at DESC);
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    product_name VARCHAR(160) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(19, 2) NOT NULL,
    subtotal NUMERIC(19, 2) NOT NULL,
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT ck_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT ck_order_items_unit_price CHECK (unit_price > 0),
    CONSTRAINT ck_order_items_subtotal CHECK (subtotal > 0)
);

CREATE INDEX idx_order_items_order ON order_items (order_id);
