package com.foody.backend.geocoding.application;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
class GeocodingInFlightRegistry {
    private final Set<UUID> inFlight = ConcurrentHashMap.newKeySet();

    boolean acquire(UUID orderId) { return inFlight.add(orderId); }
    void release(UUID orderId) { inFlight.remove(orderId); }
}
