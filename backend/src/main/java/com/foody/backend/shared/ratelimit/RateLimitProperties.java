package com.foody.backend.shared.ratelimit;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.rate-limit")
public record RateLimitProperties(Limit login, Limit register, Limit geocoding, Duration bucketIdleTtl, int maxBuckets) {
    public record Limit(long capacity, Duration period) { }
}
