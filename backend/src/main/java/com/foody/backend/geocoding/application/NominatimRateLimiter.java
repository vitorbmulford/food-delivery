package com.foody.backend.geocoding.application;

import java.time.Duration;
import java.time.Instant;
import org.springframework.stereotype.Component;

@Component
class NominatimRateLimiter {
    private Instant nextRequestAt = Instant.EPOCH;

    synchronized void awaitPermit() throws InterruptedException {
        Instant now = Instant.now();
        if (now.isBefore(nextRequestAt)) {
            Thread.sleep(Duration.between(now, nextRequestAt));
        }
        nextRequestAt = Instant.now().plusSeconds(1);
    }
}
