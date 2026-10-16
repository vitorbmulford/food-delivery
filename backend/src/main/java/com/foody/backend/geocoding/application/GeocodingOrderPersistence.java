package com.foody.backend.geocoding.application;

import com.foody.backend.geocoding.domain.GeocodingResult;
import com.foody.backend.orders.domain.DeliveryAddress;
import com.foody.backend.orders.domain.Order;
import com.foody.backend.orders.infrastructure.persistence.OrderRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class GeocodingOrderPersistence {
    private final OrderRepository orders;

    GeocodingOrderPersistence(OrderRepository orders) { this.orders = orders; }

    @Transactional
    public Optional<DeliveryAddress> prepare(UUID orderId) {
        return orders.findById(orderId)
                .filter(order -> order.prepareGeocoding(Instant.now()))
                .map(Order::getDeliveryAddress);
    }

    @Transactional
    public void apply(UUID orderId, GeocodingResult result) {
        orders.findById(orderId).ifPresent(order -> order.applyGeocoding(result.status(), result.coordinates()));
    }
}
