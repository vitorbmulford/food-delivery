package com.foody.backend.geocoding.infrastructure;

import java.time.Duration;

public class GeocodingProviderException extends RuntimeException {
    private final int status;
    private final Duration retryAfter;

    public GeocodingProviderException(int status, Duration retryAfter) {
        this(status, retryAfter, null);
    }

    public GeocodingProviderException(int status, Duration retryAfter, Throwable cause) {
        super("Geocoding provider returned " + status, cause);
        this.status = status;
        this.retryAfter = retryAfter;
    }
    public int status() { return status; }
    public Duration retryAfter() { return retryAfter; }
    public boolean isTransient() { return status == 429 || status == 502 || status == 503 || status == 504 || status == 0; }
}
