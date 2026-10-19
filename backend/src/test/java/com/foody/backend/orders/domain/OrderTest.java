package com.foody.backend.orders.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.foody.backend.auth.domain.User;
import com.foody.backend.geocoding.domain.CoordinateSource;
import com.foody.backend.geocoding.domain.GeoCoordinates;
import com.foody.backend.geocoding.domain.GeocodingStatus;
import com.foody.backend.geocoding.domain.GeocodingResult;
import com.foody.backend.geocoding.domain.GeocodingSuggestionLevel;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OrderTest {
    private final Instant now = Instant.parse("2026-10-16T20:00:00Z");

    @Test
    void calculatesSubtotalsTotalAndInitialStatus() {
        Order order = order();

        assertEquals(OrderStatus.RECEBIDO, order.getStatus());
        assertEquals(new BigDecimal("65.80"), order.getItems().getFirst().getSubtotal());
        assertEquals(new BigDecimal("8.50"), order.getItems().get(1).getSubtotal());
        assertEquals(new BigDecimal("74.30"), order.getTotalAmount());
    }

    @Test
    void acceptsOnlyDefinedStatusTransitionsAndKeepsTerminalStates() {
        Order order = order();
        order.transitionTo(OrderStatus.EM_PREPARO, now.plusSeconds(1));
        order.transitionTo(OrderStatus.SAIU_PARA_ENTREGA, now.plusSeconds(2));
        order.transitionTo(OrderStatus.ENTREGUE, now.plusSeconds(3));

        assertEquals(OrderStatus.ENTREGUE, order.getStatus());
        assertThrows(InvalidOrderStatusTransitionException.class,
                () -> order.transitionTo(OrderStatus.CANCELADO, now.plusSeconds(4)));
    }

    @Test
    void rejectsSkippedAndBackwardTransitions() {
        Order order = order();

        assertThrows(InvalidOrderStatusTransitionException.class,
                () -> order.transitionTo(OrderStatus.SAIU_PARA_ENTREGA, now));
        order.transitionTo(OrderStatus.EM_PREPARO, now);
        assertThrows(InvalidOrderStatusTransitionException.class,
                () -> order.transitionTo(OrderStatus.RECEBIDO, now));
    }

    @Test
    void rejectsAmountsThatCannotFitDatabasePrecisionAfterRounding() {
        assertEquals(new BigDecimal("99999999999999999.99"),
                OrderItem.create("Burger", 1, new BigDecimal("99999999999999999.994")).getSubtotal());
        assertThrows(OrderValueOutOfRangeException.class,
                () -> OrderItem.create("Burger", 1, new BigDecimal("99999999999999999.995")));
        assertThrows(OrderValueOutOfRangeException.class,
                () -> OrderItem.create("Burger", 2, new BigDecimal("60000000000000000.00")));
        User customer = new User(UUID.randomUUID(), "Customer", "customer@example.com", "hash", now);
        assertThrows(OrderValueOutOfRangeException.class, () -> Order.create(customer,
                new DeliveryAddress("Street", "1", null, "Center", "City", "SP", "01001000"),
                List.of(OrderItem.create("Burger", 1, new BigDecimal("60000000000000000.00")),
                        OrderItem.create("Soda", 1, new BigDecimal("60000000000000000.00"))), now));
    }

    @Test
    void manualCoordinatesCannotBeOverwrittenByLaterAutomaticResult() {
        Order order = order();
        GeoCoordinates manual = new GeoCoordinates(new BigDecimal("-23.550520"), new BigDecimal("-46.633309"));

        order.confirmManualCoordinates(manual, now.plusSeconds(1));
        order.applyGeocoding(GeocodingStatus.SUCCESS,
                new GeoCoordinates(new BigDecimal("-22.000000"), new BigDecimal("-45.000000")));

        assertEquals(manual, order.getCoordinates());
        assertEquals(CoordinateSource.MANUAL, order.getCoordinateSource());
        assertEquals(GeocodingStatus.SUCCESS, order.getGeocodingStatus());
    }

    @Test
    void approximateSuggestionRemainsSeparateAndIsClearedByManualConfirmation() {
        Order order = order();
        GeoCoordinates suggestion = new GeoCoordinates(new BigDecimal("-23.561400"), new BigDecimal("-46.655900"));
        GeoCoordinates manual = new GeoCoordinates(new BigDecimal("-23.550520"), new BigDecimal("-46.633309"));

        order.applyGeocoding(GeocodingResult.approximate(suggestion, GeocodingSuggestionLevel.STREET));

        assertEquals(GeocodingStatus.NOT_FOUND, order.getGeocodingStatus());
        assertEquals(suggestion, order.getSuggestedCoordinates());
        assertEquals(GeocodingSuggestionLevel.STREET, order.getGeocodingSuggestionLevel());
        assertEquals(null, order.getCoordinates());

        order.confirmManualCoordinates(manual, now.plusSeconds(1));
        order.applyGeocoding(GeocodingResult.approximate(suggestion, GeocodingSuggestionLevel.NEIGHBORHOOD));

        assertEquals(manual, order.getCoordinates());
        assertEquals(null, order.getSuggestedCoordinates());
        assertEquals(null, order.getGeocodingSuggestionLevel());
        assertEquals(CoordinateSource.MANUAL, order.getCoordinateSource());
    }

    private Order order() {
        User customer = new User(UUID.randomUUID(), "Customer", "customer@example.com", "hash", now);
        return Order.create(customer, new DeliveryAddress("Street", "1", null, "Center", "City", "SP", "01001000"),
                List.of(OrderItem.create("Burger", 2, new BigDecimal("32.90")), OrderItem.create("Soda", 1, new BigDecimal("8.50"))), now);
    }
}
