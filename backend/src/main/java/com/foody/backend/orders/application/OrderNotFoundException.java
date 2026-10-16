package com.foody.backend.orders.application;

public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException() { super("Order not found"); }
}
