package com.foody.backend.orders.api.dto;

import com.foody.backend.orders.domain.OrderStatus;
import java.time.Instant;
import java.util.UUID;

public record OrderStatusHistoryResponse(
        UUID id,
        OrderStatus previousStatus,
        OrderStatus newStatus,
        Instant changedAt,
        UUID changedBy) { }
