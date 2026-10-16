package com.foody.backend.orders.api.dto;

import java.util.UUID;

public record OrderCustomerResponse(UUID id, String name, String email) { }
