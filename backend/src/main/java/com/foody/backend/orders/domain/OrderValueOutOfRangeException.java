package com.foody.backend.orders.domain;

public class OrderValueOutOfRangeException extends RuntimeException {
    public OrderValueOutOfRangeException() {
        super("Order amount exceeds the maximum supported value");
    }
}
