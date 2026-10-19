package com.foody.backend.orders.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateOrderItemRequest(
        @NotBlank @Size(max = 160) @Schema(example = "Hambúrguer Artesanal") String productName,
        @NotNull @Positive @Schema(example = "2") Integer quantity,
        @NotNull @DecimalMin(value = "0.01") @Schema(example = "32.90") BigDecimal unitPrice) { }
