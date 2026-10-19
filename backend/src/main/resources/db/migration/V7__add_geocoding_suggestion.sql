ALTER TABLE orders
    ADD COLUMN suggested_latitude NUMERIC(9, 6),
    ADD COLUMN suggested_longitude NUMERIC(9, 6),
    ADD COLUMN geocoding_suggestion_level VARCHAR(20);

ALTER TABLE orders
    ADD CONSTRAINT ck_orders_suggested_coordinates_together
        CHECK ((suggested_latitude IS NULL) = (suggested_longitude IS NULL)),
    ADD CONSTRAINT ck_orders_suggested_latitude_range
        CHECK (suggested_latitude IS NULL OR suggested_latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT ck_orders_suggested_longitude_range
        CHECK (suggested_longitude IS NULL OR suggested_longitude BETWEEN -180 AND 180),
    ADD CONSTRAINT ck_orders_geocoding_suggestion_level
        CHECK (geocoding_suggestion_level IS NULL
            OR geocoding_suggestion_level IN ('STREET', 'NEIGHBORHOOD', 'POSTAL_CODE')),
    ADD CONSTRAINT ck_orders_suggestion_complete
        CHECK ((suggested_latitude IS NULL AND geocoding_suggestion_level IS NULL)
            OR (suggested_latitude IS NOT NULL AND geocoding_suggestion_level IS NOT NULL));
