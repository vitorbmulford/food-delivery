package com.foody.backend.orders.infrastructure.realtime;

import com.foody.backend.orders.domain.OrderStatus;
import java.time.Instant;
import java.util.UUID;

public record OrderStatusChangedMessage(
        String eventType,
        UUID orderId,
        OrderStatus previousStatus,
        OrderStatus newStatus,
        UUID historyId,
        Instant changedAt) {
}
