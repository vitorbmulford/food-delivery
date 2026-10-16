package com.foody.backend.geocoding.application;

import java.util.UUID;

public record OrderGeocodingRequestedEvent(UUID orderId) { }
