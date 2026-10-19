package com.foody.backend.geocoding.application;

import com.foody.backend.geocoding.infrastructure.NominatimGeocodingClient;
import com.foody.backend.geocoding.infrastructure.GeocodingProviderException;
import com.foody.backend.geocoding.infrastructure.TransientGeocodingProviderException;
import com.foody.backend.geocoding.domain.GeocodingResult;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class GeocodingService {
    static final Duration MAX_RETRY_AFTER_WAIT = Duration.ofMinutes(1);
    private static final Logger LOGGER = LoggerFactory.getLogger(GeocodingService.class);
    private final GeocodingOrderPersistence persistence;
    private final NominatimGeocodingClient client;
    private final NominatimRateLimiter rateLimiter;
    private final GeocodingInFlightRegistry registry;
    private final CircuitBreaker circuitBreaker;
    private final Retry retry;
    private final Counter requests;
    private final Counter failures;
    private final MeterRegistry meterRegistry;

    GeocodingService(GeocodingOrderPersistence persistence, NominatimGeocodingClient client,
                     NominatimRateLimiter rateLimiter, GeocodingInFlightRegistry registry,
                     GeocodingResilienceProperties resilience, MeterRegistry meterRegistry) {
        this.persistence = persistence;
        this.client = client;
        this.rateLimiter = rateLimiter;
        this.registry = registry;
        this.meterRegistry = meterRegistry;
        CircuitBreakerConfig breakerConfig = CircuitBreakerConfig.custom()
                .slidingWindowSize(resilience.circuitBreaker().slidingWindowSize())
                .minimumNumberOfCalls(resilience.circuitBreaker().minimumNumberOfCalls())
                .failureRateThreshold(resilience.circuitBreaker().failureRateThreshold())
                .waitDurationInOpenState(resilience.circuitBreaker().waitDurationInOpenState())
                .permittedNumberOfCallsInHalfOpenState(resilience.circuitBreaker().permittedCallsInHalfOpenState())
                .recordException(this::isTransient).build();
        this.circuitBreaker = CircuitBreaker.of("nominatim", breakerConfig);
        RetryConfig retryConfig = RetryConfig.custom().maxAttempts(resilience.retry().maxAttempts())
                .intervalFunction(attempt -> backoff(attempt, resilience.retry()))
                .retryExceptions(TransientGeocodingProviderException.class).build();
        this.retry = Retry.of("nominatim", retryConfig);
        this.requests = Counter.builder("geocoding.requests").description("Nominatim HTTP attempts").register(meterRegistry);
        this.failures = Counter.builder("geocoding.failures").description("Failed geocoding operations").register(meterRegistry);
        circuitBreaker.getEventPublisher().onStateTransition(event -> LOGGER.warn("Geocoding circuit breaker transition={}", event.getStateTransition()));
        retry.getEventPublisher().onRetry(event -> LOGGER.warn("Geocoding retry scheduled attempt={}", event.getNumberOfRetryAttempts()));
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
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = "FAILED";
        try {
            // The breaker surrounds the whole logical operation: one exhausted retry sequence is one breaker outcome.
            GeocodingResult result = circuitBreaker.executeSupplier(() -> retry.executeSupplier(() -> attempt(address)));
            persistence.apply(orderId, result);
            outcome = result.status().name();
        } catch (CallNotPermittedException exception) {
            failures.increment();
            LOGGER.warn("Geocoding rejected by open circuit breaker orderId={}", orderId);
            markFailed(orderId);
        } catch (RuntimeException exception) {
            failures.increment();
            LOGGER.warn("Unexpected geocoding failure for order {}: {}", orderId, exception.getClass().getSimpleName());
            markFailed(orderId);
        } finally {
            sample.stop(Timer.builder("geocoding.duration").tag("outcome", outcome)
                    .description("Complete geocoding operation, including retry waits").register(meterRegistry));
        }
    }

    CircuitBreaker.State circuitState() { return circuitBreaker.getState(); }

    private GeocodingResult attempt(com.foody.backend.orders.domain.DeliveryAddress address) {
        try {
            rateLimiter.awaitPermit();
            requests.increment();
            return client.geocodeOrThrow(address);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new TransientGeocodingProviderException(0, null);
        } catch (GeocodingProviderException exception) {
            Duration retryAfter = permittedRetryAfter(exception.retryAfter());
            if (retryAfter != null) {
                rateLimiter.deferUntil(Instant.now().plus(retryAfter));
            }
            throw exception;
        }
    }

    private boolean isTransient(Throwable exception) {
        return exception instanceof GeocodingProviderException provider && provider.isTransient();
    }

    static Duration permittedRetryAfter(Duration retryAfter) {
        return retryAfter != null && !retryAfter.isNegative() && retryAfter.compareTo(MAX_RETRY_AFTER_WAIT) <= 0
                ? retryAfter : null;
    }

    private long backoff(int attempt, GeocodingResilienceProperties.Retry policy) {
        double exponential = policy.initialDelay().toMillis() * Math.pow(policy.multiplier(), Math.max(0, attempt - 1));
        double spread = exponential * policy.jitter();
        long jittered = Math.round(spread == 0 ? exponential
                : exponential + ThreadLocalRandom.current().nextDouble(-spread, spread));
        return Math.min(policy.maxDelay().toMillis(), Math.max(0, jittered));
    }

    private void markFailed(UUID orderId) {
        try {
            persistence.apply(orderId, GeocodingResult.failed());
        } catch (RuntimeException exception) {
            LOGGER.error("Unable to persist geocoding failure for order {}", orderId, exception);
        }
    }
}
