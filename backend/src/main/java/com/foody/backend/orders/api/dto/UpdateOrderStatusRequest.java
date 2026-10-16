package com.foody.backend.orders.api.dto;

import com.foody.backend.orders.domain.OrderStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStatusRequest(
        @NotNull @Schema(example = "EM_PREPARO", allowableValues = {"RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO"}) OrderStatus status) { }
