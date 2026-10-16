CREATE TABLE order_status_history (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    changed_by UUID,
    CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders (id),
    CONSTRAINT fk_order_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users (id),
    CONSTRAINT ck_order_status_history_previous_status CHECK (previous_status IS NULL OR previous_status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO')),
    CONSTRAINT ck_order_status_history_new_status CHECK (new_status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO'))
);

CREATE INDEX idx_order_status_history_order_changed_at_id
    ON order_status_history (order_id, changed_at, id);
