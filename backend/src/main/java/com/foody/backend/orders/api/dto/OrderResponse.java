package com.foody.backend.orders.api.dto;

import com.foody.backend.orders.domain.OrderStatus;
import com.foody.backend.geocoding.domain.GeocodingStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(UUID id, OrderCustomerResponse customer, OrderStatus status, List<OrderItemResponse> items,
                            DeliveryAddressResponse deliveryAddress, BigDecimal totalAmount,
                            Instant createdAt, Instant updatedAt, GeoCoordinatesResponse coordinates,
                            GeocodingStatus geocodingStatus) {
    public OrderResponse {
        items = List.copyOf(items);
    }
}
