package com.foody.backend.orders.api.dto;

import com.foody.backend.orders.domain.OrderStatus;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record DashboardResponse(
        LocalDate from,
        LocalDate to,
        long totalCreated,
        Map<OrderStatus, Long> statusCounts,
        long deliveredInPeriod,
        long cancelledInPeriod,
        List<DailyActivity> dailyActivity,
        List<DashboardOrder> recentOrders,
        List<DashboardOrder> ongoingOrders) {

    public DashboardResponse {
        statusCounts = Map.copyOf(statusCounts);
        dailyActivity = List.copyOf(dailyActivity);
        recentOrders = List.copyOf(recentOrders);
        ongoingOrders = List.copyOf(ongoingOrders);
    }

    public record DailyActivity(LocalDate date, long created, long delivered, long cancelled) { }
    public record DashboardOrder(UUID id, Instant createdAt, OrderStatus status) { }
}
