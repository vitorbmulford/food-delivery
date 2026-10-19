package com.foody.backend.orders.application.event;

import com.foody.backend.orders.domain.OrderStatus;
import java.time.Instant;
import java.util.UUID;

/** Immutable data captured while the status transition transaction is still active. */
public record OrderStatusChangedEvent(
        UUID orderId,
        UUID ownerId,
        OrderStatus previousStatus,
        OrderStatus newStatus,
        UUID historyId,
        Instant changedAt) {
}
