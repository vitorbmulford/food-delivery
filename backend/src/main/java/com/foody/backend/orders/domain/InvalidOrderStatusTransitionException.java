package com.foody.backend.orders.domain;

public class InvalidOrderStatusTransitionException extends RuntimeException {
    public InvalidOrderStatusTransitionException(OrderStatus current, OrderStatus target) {
        super("Cannot transition order from %s to %s".formatted(current, target));
    }
}
