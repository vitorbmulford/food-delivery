ALTER TABLE orders
    ADD COLUMN latitude NUMERIC(9, 6),
    ADD COLUMN longitude NUMERIC(9, 6),
    ADD COLUMN geocoding_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN geocoding_last_attempt_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE orders
    ADD CONSTRAINT ck_orders_geocoding_status
        CHECK (geocoding_status IN ('PENDING', 'SUCCESS', 'NOT_FOUND', 'FAILED')),
    ADD CONSTRAINT ck_orders_coordinates_together
        CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
    ADD CONSTRAINT ck_orders_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT ck_orders_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
