package com.foody.backend.geocoding.domain;

import java.util.Objects;

public record GeocodingResult(GeocodingStatus status, GeoCoordinates coordinates,
                              GeoCoordinates suggestedCoordinates,
                              GeocodingSuggestionLevel suggestionLevel) {
    public GeocodingResult(GeocodingStatus status, GeoCoordinates coordinates) {
        this(status, coordinates, null, null);
    }

    public GeocodingResult {
        Objects.requireNonNull(status, "status is required");
        if ((status == GeocodingStatus.SUCCESS) != (coordinates != null)) {
            throw new IllegalArgumentException("Successful geocoding requires coordinates");
        }
        if ((suggestedCoordinates == null) != (suggestionLevel == null)) {
            throw new IllegalArgumentException("Suggested coordinates require a suggestion level");
        }
        if (suggestedCoordinates != null && status != GeocodingStatus.NOT_FOUND) {
            throw new IllegalArgumentException("Only a not-found result can contain an approximate suggestion");
        }
    }

    public static GeocodingResult success(GeoCoordinates coordinates) { return new GeocodingResult(GeocodingStatus.SUCCESS, coordinates); }
    public static GeocodingResult notFound() { return new GeocodingResult(GeocodingStatus.NOT_FOUND, null); }
    public static GeocodingResult approximate(GeoCoordinates coordinates, GeocodingSuggestionLevel level) {
        return new GeocodingResult(GeocodingStatus.NOT_FOUND, null,
                Objects.requireNonNull(coordinates), Objects.requireNonNull(level));
    }
    public static GeocodingResult failed() { return new GeocodingResult(GeocodingStatus.FAILED, null); }
}
