package com.foody.backend.geocoding.application;

import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class GeocodingDispatcher {
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
        geocoding.geocodeAsync(orderId);
        return true;
    }
}
