package com.foody.backend.orders.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateOrderRequest(
        @NotNull @Valid CreateOrderCustomerRequest customer,
        @NotEmpty List<@Valid CreateOrderItemRequest> items,
        @NotNull @Valid DeliveryAddressRequest deliveryAddress) {
    public CreateOrderRequest {
        items = items == null ? null : List.copyOf(items);
    }
}
