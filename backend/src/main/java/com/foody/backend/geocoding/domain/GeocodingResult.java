package com.foody.backend.geocoding.domain;

import java.util.Objects;

public record GeocodingResult(GeocodingStatus status, GeoCoordinates coordinates) {
    public GeocodingResult {
        Objects.requireNonNull(status, "status is required");
        if ((status == GeocodingStatus.SUCCESS) != (coordinates != null)) {
            throw new IllegalArgumentException("Successful geocoding requires coordinates");
        }
    }

    public static GeocodingResult success(GeoCoordinates coordinates) { return new GeocodingResult(GeocodingStatus.SUCCESS, coordinates); }
    public static GeocodingResult notFound() { return new GeocodingResult(GeocodingStatus.NOT_FOUND, null); }
    public static GeocodingResult failed() { return new GeocodingResult(GeocodingStatus.FAILED, null); }
}
