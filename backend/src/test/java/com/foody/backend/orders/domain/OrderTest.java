package com.foody.backend.orders.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.foody.backend.auth.domain.User;
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

    private Order order() {
        User customer = new User(UUID.randomUUID(), "Customer", "customer@example.com", "hash", now);
        return Order.create(customer, new DeliveryAddress("Street", "1", null, "Center", "City", "SP", "01001000"),
                List.of(OrderItem.create("Burger", 2, new BigDecimal("32.90")), OrderItem.create("Soda", 1, new BigDecimal("8.50"))), now);
    }
}
