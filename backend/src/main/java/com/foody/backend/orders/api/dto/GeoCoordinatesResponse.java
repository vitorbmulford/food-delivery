package com.foody.backend.orders.api.dto;

import java.math.BigDecimal;

public record GeoCoordinatesResponse(BigDecimal latitude, BigDecimal longitude) { }
