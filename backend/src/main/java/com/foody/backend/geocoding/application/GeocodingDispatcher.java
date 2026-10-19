package com.foody.backend.geocoding.application;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class GeocodingDispatcher {
    private static final Logger LOGGER = LoggerFactory.getLogger(GeocodingDispatcher.class);
    private final GeocodingInFlightRegistry registry;
    private final GeocodingService geocoding;

    GeocodingDispatcher(GeocodingInFlightRegistry registry, GeocodingService geocoding) {
        this.registry = registry;
        this.geocoding = geocoding;
    }

    public boolean schedule(UUID orderId) {
        if (!registry.acquire(orderId)) {
            return false;
        }
        try {
            geocoding.geocodeAsync(orderId);
            return true;
        } catch (RuntimeException exception) {
            registry.release(orderId);
            LOGGER.warn("Could not queue geocoding for order {}: {}", orderId, exception.getClass().getSimpleName());
            return false;
        }
    }
}
