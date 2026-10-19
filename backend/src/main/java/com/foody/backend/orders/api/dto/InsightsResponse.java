package com.foody.backend.orders.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Commercial and performance aggregates for one business-calendar period. */
public record InsightsResponse(
        LocalDate from,
        LocalDate to,
        Summary current,
        Summary previous,
        List<Day> daily,
        List<StatusValue> currentStatusValues,
        List<Hour> hourly,
        List<Product> products,
        Performance performance) {
    public InsightsResponse {
        daily = List.copyOf(daily);
        currentStatusValues = List.copyOf(currentStatusValues);
        hourly = List.copyOf(hourly);
        products = List.copyOf(products);
    }

    public record Summary(BigDecimal createdValue, long createdCount,
                          BigDecimal deliveredValue, long deliveredCount,
                          BigDecimal cancelledValue, long cancelledCount,
                          BigDecimal ongoingValue, BigDecimal averageDeliveredTicket,
                          long itemsSold) { }
    public record Day(LocalDate date, BigDecimal createdValue, BigDecimal deliveredValue,
                      BigDecimal cancelledValue, long createdCount, long deliveredCount,
                      long cancelledCount) { }
    public record StatusValue(String status, BigDecimal value, long count) { }
    public record Hour(int hour, long count) { }
    public record Product(String name, long quantity, BigDecimal value, BigDecimal sharePercent) { }
    public record Performance(BigDecimal receivedToPreparationMinutes, long receivedToPreparationCount,
                              BigDecimal preparationMinutes, long preparationCount,
                              BigDecimal deliveryMinutes, long deliveryCount,
                              BigDecimal totalMinutes, long totalCount) { }
}
