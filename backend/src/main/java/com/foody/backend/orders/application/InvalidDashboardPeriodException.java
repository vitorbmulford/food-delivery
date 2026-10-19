package com.foody.backend.orders.application;

public class InvalidDashboardPeriodException extends RuntimeException {
    public InvalidDashboardPeriodException() {
        super("Dashboard period must be ordered, no longer than 366 days, and cannot include future dates");
    }
}
