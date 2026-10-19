package com.foody.backend.geocoding.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.geocoding-resilience")
public record GeocodingResilienceProperties(Retry retry, CircuitBreaker circuitBreaker) {
    public record Retry(int maxAttempts, Duration initialDelay, Duration maxDelay, double multiplier, double jitter) { }
    public record CircuitBreaker(int slidingWindowSize, int minimumNumberOfCalls, float failureRateThreshold,
                                 Duration waitDurationInOpenState, int permittedCallsInHalfOpenState) { }
}
