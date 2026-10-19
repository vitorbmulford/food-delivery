ALTER TABLE orders
    ADD COLUMN coordinate_source VARCHAR(20);

UPDATE orders
SET coordinate_source = 'AUTOMATIC'
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

ALTER TABLE orders
    ADD CONSTRAINT ck_orders_coordinate_source
        CHECK (coordinate_source IS NULL OR coordinate_source IN ('AUTOMATIC', 'MANUAL')),
    ADD CONSTRAINT ck_orders_coordinate_source_with_coordinates
        CHECK ((latitude IS NULL AND longitude IS NULL AND coordinate_source IS NULL)
            OR (latitude IS NOT NULL AND longitude IS NOT NULL AND coordinate_source IS NOT NULL));
