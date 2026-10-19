package com.foody.backend.orders.application;

import com.foody.backend.orders.api.dto.DashboardResponse;
import com.foody.backend.orders.domain.OrderStatus;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {
    public static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final int MAX_PERIOD_DAYS = 366;
    private final JdbcTemplate jdbc;

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "JdbcTemplate is a Spring-managed shared collaborator intentionally retained by this service.")
    public DashboardService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(UUID ownerId, LocalDate from, LocalDate to) {
        validatePeriod(from, to);
        var start = Timestamp.from(from.atStartOfDay(BUSINESS_ZONE).toInstant());
        var end = Timestamp.from(to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant());

        long total = scalar("SELECT count(*) FROM orders WHERE customer_id = ? AND created_at >= ? AND created_at < ?",
                ownerId, start, end);
        Map<OrderStatus, Long> statuses = new EnumMap<>(OrderStatus.class);
        for (OrderStatus status : OrderStatus.values()) statuses.put(status, 0L);
        jdbc.query("SELECT status, count(*) FROM orders WHERE customer_id = ? AND created_at >= ? AND created_at < ? GROUP BY status",
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> statuses.put(OrderStatus.valueOf(rs.getString(1)), rs.getLong(2)), ownerId, start, end);

        long delivered = scalar("SELECT count(*) FROM order_status_history h JOIN orders o ON o.id = h.order_id "
                + "WHERE o.customer_id = ? AND h.new_status = 'ENTREGUE' AND h.changed_at >= ? AND h.changed_at < ?",
                ownerId, start, end);
        long cancelled = scalar("SELECT count(*) FROM order_status_history h JOIN orders o ON o.id = h.order_id "
                + "WHERE o.customer_id = ? AND h.new_status = 'CANCELADO' AND h.changed_at >= ? AND h.changed_at < ?",
                ownerId, start, end);

        List<DashboardResponse.DailyActivity> daily = jdbc.query("""
                WITH days AS (
                  SELECT generate_series(?::date, ?::date, interval '1 day')::date AS day
                ), created AS (
                  SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, count(*) AS amount
                  FROM orders WHERE customer_id = ? AND created_at >= ? AND created_at < ? GROUP BY 1
                ), events AS (
                  SELECT (h.changed_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
                    count(*) FILTER (WHERE h.new_status = 'ENTREGUE') AS delivered,
                    count(*) FILTER (WHERE h.new_status = 'CANCELADO') AS cancelled
                  FROM order_status_history h JOIN orders o ON o.id = h.order_id
                  WHERE o.customer_id = ? AND h.new_status IN ('ENTREGUE', 'CANCELADO')
                    AND h.changed_at >= ? AND h.changed_at < ? GROUP BY 1
                )
                SELECT days.day, coalesce(created.amount, 0), coalesce(events.delivered, 0), coalesce(events.cancelled, 0)
                FROM days LEFT JOIN created USING (day) LEFT JOIN events USING (day) ORDER BY days.day
                """, (rs, rowNum) -> new DashboardResponse.DailyActivity(rs.getDate(1).toLocalDate(),
                rs.getLong(2), rs.getLong(3), rs.getLong(4)), from, to, ownerId, start, end, ownerId, start, end);

        List<DashboardResponse.DashboardOrder> recent = jdbc.query("SELECT id, created_at, status FROM orders "
                        + "WHERE customer_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 8",
                (rs, rowNum) -> new DashboardResponse.DashboardOrder(rs.getObject(1, UUID.class),
                        rs.getTimestamp(2).toInstant(), OrderStatus.valueOf(rs.getString(3))), ownerId, start, end);
        List<DashboardResponse.DashboardOrder> ongoing = jdbc.query("SELECT id, created_at, status FROM orders "
                        + "WHERE customer_id = ? AND status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA') "
                        + "ORDER BY created_at ASC LIMIT 10",
                (rs, rowNum) -> new DashboardResponse.DashboardOrder(rs.getObject(1, UUID.class),
                        rs.getTimestamp(2).toInstant(), OrderStatus.valueOf(rs.getString(3))), ownerId);
        return new DashboardResponse(from, to, total, Map.copyOf(statuses), delivered, cancelled, daily, recent, ongoing);
    }

    private long scalar(String sql, Object... args) {
        Long result = jdbc.queryForObject(sql, Long.class, args);
        return result == null ? 0 : result;
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        if (from == null || to == null || from.isAfter(to) || to.isAfter(today)
                || from.plusDays(MAX_PERIOD_DAYS - 1L).isBefore(to)) {
            throw new InvalidDashboardPeriodException();
        }
    }
}
