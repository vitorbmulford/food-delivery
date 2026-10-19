package com.foody.backend.orders.application;

import com.foody.backend.orders.api.dto.InsightsResponse;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** PostgreSQL-side analytics; every independent aggregate avoids item/history join multiplication. */
@Service
public class InsightsService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("America/Sao_Paulo");
    private static final int MAX_PERIOD_DAYS = 366;
    private final JdbcTemplate jdbc;

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "JdbcTemplate is a Spring-managed collaborator.")
    public InsightsService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public InsightsResponse getInsights(UUID ownerId, LocalDate from, LocalDate to) {
        validatePeriod(from, to);
        int days = Math.toIntExact(to.toEpochDay() - from.toEpochDay() + 1);
        LocalDate previousTo = from.minusDays(1);
        LocalDate previousFrom = previousTo.minusDays(days - 1L);
        return new InsightsResponse(from, to, summary(ownerId, from, to), summary(ownerId, previousFrom, previousTo),
                daily(ownerId, from, to), currentStatuses(ownerId), hourly(ownerId, from, to),
                products(ownerId, from, to), performance(ownerId, from, to));
    }

    private InsightsResponse.Summary summary(UUID ownerId, LocalDate from, LocalDate to) {
        Timestamp start = start(from), end = end(to);
        var created = jdbc.queryForMap("SELECT count(*) AS n, coalesce(sum(total_amount),0) AS v FROM orders "
                + "WHERE customer_id=? AND created_at>=? AND created_at<?", ownerId, start, end);
        var delivered = jdbc.queryForMap("WITH events AS (SELECT DISTINCT ON (h.order_id) h.order_id FROM order_status_history h "
                + "JOIN orders o ON o.id=h.order_id WHERE o.customer_id=? AND h.new_status='ENTREGUE' AND h.changed_at>=? AND h.changed_at<? ORDER BY h.order_id,h.changed_at) "
                + "SELECT count(*) AS n, coalesce(sum(o.total_amount),0) AS v, coalesce(sum(i.qty),0) AS items "
                + "FROM events e JOIN orders o ON o.id=e.order_id LEFT JOIN (SELECT order_id,sum(quantity) qty FROM order_items GROUP BY order_id) i ON i.order_id=o.id",
                ownerId, start, end);
        var cancelled = jdbc.queryForMap("WITH events AS (SELECT DISTINCT ON (h.order_id) h.order_id FROM order_status_history h "
                + "JOIN orders o ON o.id=h.order_id WHERE o.customer_id=? AND h.new_status='CANCELADO' AND h.changed_at>=? AND h.changed_at<? ORDER BY h.order_id,h.changed_at) "
                + "SELECT count(*) AS n, coalesce(sum(o.total_amount),0) AS v FROM events e JOIN orders o ON o.id=e.order_id",
                ownerId, start, end);
        var ongoing = jdbc.queryForObject("SELECT coalesce(sum(total_amount),0) FROM orders WHERE customer_id=? "
                + "AND status IN ('RECEBIDO','EM_PREPARO','SAIU_PARA_ENTREGA')", BigDecimal.class, ownerId);
        long deliveredCount = number(delivered, "n");
        BigDecimal deliveredValue = money(delivered, "v");
        BigDecimal average = deliveredCount == 0 ? BigDecimal.ZERO : deliveredValue.divide(BigDecimal.valueOf(deliveredCount), 2, java.math.RoundingMode.HALF_UP);
        return new InsightsResponse.Summary(money(created, "v"), number(created, "n"), deliveredValue, deliveredCount,
                money(cancelled, "v"), number(cancelled, "n"), ongoing == null ? BigDecimal.ZERO : ongoing,
                average, number(delivered, "items"));
    }

    private List<InsightsResponse.Day> daily(UUID ownerId, LocalDate from, LocalDate to) {
        Timestamp start = start(from), end = end(to);
        return jdbc.query("""
                WITH days AS (SELECT generate_series(?::date, ?::date, interval '1 day')::date d),
                created AS (SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date d,count(*) n,sum(total_amount) v FROM orders
                  WHERE customer_id=? AND created_at>=? AND created_at<? GROUP BY 1),
                events AS (SELECT (h.changed_at AT TIME ZONE 'America/Sao_Paulo')::date d,
                  count(*) FILTER (WHERE h.new_status='ENTREGUE') dn,
                  sum(o.total_amount) FILTER (WHERE h.new_status='ENTREGUE') dv,
                  count(*) FILTER (WHERE h.new_status='CANCELADO') cn,
                  sum(o.total_amount) FILTER (WHERE h.new_status='CANCELADO') cv
                  FROM order_status_history h JOIN orders o ON o.id=h.order_id WHERE o.customer_id=?
                  AND h.new_status IN ('ENTREGUE','CANCELADO') AND h.changed_at>=? AND h.changed_at<? GROUP BY 1)
                SELECT days.d,coalesce(c.v,0) cv,coalesce(e.dv,0) dv,coalesce(e.cv,0) xv,
                  coalesce(c.n,0) cn,coalesce(e.dn,0) dn,coalesce(e.cn,0) xn
                FROM days LEFT JOIN created c ON c.d=days.d LEFT JOIN events e ON e.d=days.d ORDER BY days.d
                """, (rs, n) -> new InsightsResponse.Day(rs.getDate(1).toLocalDate(), rs.getBigDecimal(2), rs.getBigDecimal(3),
                rs.getBigDecimal(4), rs.getLong(5), rs.getLong(6), rs.getLong(7)), from, to, ownerId, start, end,
                ownerId, start, end);
    }

    private List<InsightsResponse.StatusValue> currentStatuses(UUID ownerId) {
        return jdbc.query("SELECT status,coalesce(sum(total_amount),0) v,count(*) n FROM orders WHERE customer_id=? GROUP BY status ORDER BY status",
                (rs, n) -> new InsightsResponse.StatusValue(rs.getString(1), rs.getBigDecimal(2), rs.getLong(3)), ownerId);
    }

    private List<InsightsResponse.Hour> hourly(UUID ownerId, LocalDate from, LocalDate to) {
        Timestamp start = start(from), end = end(to);
        return jdbc.query("SELECT extract(hour FROM created_at AT TIME ZONE 'America/Sao_Paulo')::int h,count(*) n FROM orders "
                        + "WHERE customer_id=? AND created_at>=? AND created_at<? GROUP BY 1 ORDER BY 1",
                (rs, n) -> new InsightsResponse.Hour(rs.getInt(1), rs.getLong(2)), ownerId, start, end);
    }

    private List<InsightsResponse.Product> products(UUID ownerId, LocalDate from, LocalDate to) {
        Timestamp start = start(from), end = end(to);
        return jdbc.query("""
                WITH delivered AS (SELECT DISTINCT ON (h.order_id) h.order_id FROM order_status_history h JOIN orders o ON o.id=h.order_id
                  WHERE o.customer_id=? AND h.new_status='ENTREGUE' AND h.changed_at>=? AND h.changed_at<? ORDER BY h.order_id,h.changed_at),
                grouped AS (SELECT lower(regexp_replace(btrim(i.product_name), '\\s+', ' ', 'g')) normalized,
                  min(regexp_replace(btrim(i.product_name), '\\s+', ' ', 'g')) name,sum(i.quantity)::bigint qty,sum(i.subtotal) value
                  FROM delivered d JOIN order_items i ON i.order_id=d.order_id GROUP BY 1),
                total AS (SELECT coalesce(sum(qty),0) qty FROM grouped)
                SELECT grouped.name,grouped.qty,grouped.value,CASE WHEN total.qty=0 THEN 0 ELSE round(grouped.qty*100.0/total.qty,2) END share
                FROM grouped CROSS JOIN total ORDER BY qty DESC,value DESC,name LIMIT 10
                """, (rs, n) -> new InsightsResponse.Product(rs.getString(1), rs.getLong(2), rs.getBigDecimal(3), rs.getBigDecimal(4)), ownerId, start, end);
    }

    private InsightsResponse.Performance performance(UUID ownerId, LocalDate from, LocalDate to) {
        Timestamp start = start(from), end = end(to);
        var row = jdbc.queryForMap("""
                WITH events AS (SELECT o.id,o.created_at,
                  min(h.changed_at) FILTER (WHERE h.new_status='EM_PREPARO') prep,
                  min(h.changed_at) FILTER (WHERE h.new_status='SAIU_PARA_ENTREGA') exit,
                  min(h.changed_at) FILTER (WHERE h.new_status='ENTREGUE') delivered
                  FROM orders o JOIN order_status_history h ON h.order_id=o.id WHERE o.customer_id=?
                  AND h.new_status IN ('EM_PREPARO','SAIU_PARA_ENTREGA','ENTREGUE') GROUP BY o.id,o.created_at),
                cohort AS (SELECT * FROM events WHERE delivered>=? AND delivered<?)
                SELECT avg(extract(epoch FROM (prep-created_at))/60) FILTER (WHERE prep>=created_at) a, count(*) FILTER (WHERE prep>=created_at) ac,
                  avg(extract(epoch FROM (exit-prep))/60) FILTER (WHERE exit>=prep) b, count(*) FILTER (WHERE exit>=prep) bc,
                  avg(extract(epoch FROM (delivered-exit))/60) FILTER (WHERE delivered>=exit) c, count(*) FILTER (WHERE delivered>=exit) cc,
                  avg(extract(epoch FROM (delivered-created_at))/60) FILTER (WHERE delivered>=created_at) d,count(*) FILTER (WHERE delivered>=created_at) dc
                FROM cohort
                """, ownerId, start, end);
        return new InsightsResponse.Performance(decimal(row, "a"), number(row, "ac"), decimal(row, "b"), number(row, "bc"),
                decimal(row, "c"), number(row, "cc"), decimal(row, "d"), number(row, "dc"));
    }

    private Timestamp start(LocalDate date) { return Timestamp.from(date.atStartOfDay(BUSINESS_ZONE).toInstant()); }
    private Timestamp end(LocalDate date) { return Timestamp.from(date.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant()); }
    private void validatePeriod(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        if (from == null || to == null || from.isAfter(to) || to.isAfter(today) || from.plusDays(MAX_PERIOD_DAYS - 1L).isBefore(to))
            throw new InvalidDashboardPeriodException();
    }
    private BigDecimal money(java.util.Map<String, Object> row, String key) { Object value = row.get(key); return value == null ? BigDecimal.ZERO : (BigDecimal) value; }
    private BigDecimal decimal(java.util.Map<String, Object> row, String key) { Object value = row.get(key); return value == null ? BigDecimal.ZERO : BigDecimal.valueOf(((Number) value).doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP); }
    private long number(java.util.Map<String, Object> row, String key) { Object value = row.get(key); return value == null ? 0 : ((Number) value).longValue(); }
}
