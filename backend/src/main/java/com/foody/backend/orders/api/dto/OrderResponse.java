package com.foody.backend.orders.api.dto;

import com.foody.backend.orders.domain.OrderStatus;
import com.foody.backend.geocoding.domain.GeocodingStatus;
import com.foody.backend.geocoding.domain.CoordinateSource;
import com.foody.backend.geocoding.domain.GeocodingSuggestionLevel;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(UUID id, OrderCustomerResponse customer, OrderStatus status, List<OrderItemResponse> items,
                            DeliveryAddressResponse deliveryAddress, BigDecimal totalAmount,
                            Instant createdAt, Instant updatedAt, GeoCoordinatesResponse coordinates,
                            GeocodingStatus geocodingStatus, CoordinateSource coordinateSource,
                            GeoCoordinatesResponse suggestedCoordinates,
                            GeocodingSuggestionLevel geocodingSuggestionLevel) {
    public OrderResponse {
        items = List.copyOf(items);
    }
}
