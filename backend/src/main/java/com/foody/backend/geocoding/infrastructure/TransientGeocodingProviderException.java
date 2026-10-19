package com.foody.backend.geocoding.infrastructure;

import java.time.Duration;

public final class TransientGeocodingProviderException extends GeocodingProviderException {
    public TransientGeocodingProviderException(int status, Duration retryAfter) { super(status, retryAfter); }
    public TransientGeocodingProviderException(int status, Duration retryAfter, Throwable cause) {
        super(status, retryAfter, cause);
    }
}
