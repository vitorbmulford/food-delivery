package com.foody.backend.geocoding.application;

import com.foody.backend.geocoding.infrastructure.NominatimGeocodingClient;
import com.foody.backend.geocoding.domain.GeocodingResult;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class GeocodingService {
    private static final Logger LOGGER = LoggerFactory.getLogger(GeocodingService.class);
    private final GeocodingOrderPersistence persistence;
    private final NominatimGeocodingClient client;
    private final NominatimRateLimiter rateLimiter;
    private final GeocodingInFlightRegistry registry;

    GeocodingService(GeocodingOrderPersistence persistence, NominatimGeocodingClient client,
                     NominatimRateLimiter rateLimiter, GeocodingInFlightRegistry registry) {
        this.persistence = persistence;
        this.client = client;
        this.rateLimiter = rateLimiter;
        this.registry = registry;
    }

    @Async("geocodingExecutor")
    public void geocodeAsync(UUID orderId) {
        try {
            persistence.prepare(orderId).ifPresent(address -> geocode(orderId, address));
        } finally {
            registry.release(orderId);
        }
    }

    private void geocode(UUID orderId, com.foody.backend.orders.domain.DeliveryAddress address) {
        try {
            rateLimiter.awaitPermit();
            persistence.apply(orderId, client.geocode(address));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOGGER.warn("Geocoding interrupted for order {}", orderId);
            markFailed(orderId);
        } catch (RuntimeException exception) {
            LOGGER.warn("Unexpected geocoding failure for order {}: {}", orderId, exception.getClass().getSimpleName());
            markFailed(orderId);
        }
    }

    private void markFailed(UUID orderId) {
        try {
            persistence.apply(orderId, GeocodingResult.failed());
        } catch (RuntimeException exception) {
            LOGGER.error("Unable to persist geocoding failure for order {}", orderId, exception);
        }
    }
}
