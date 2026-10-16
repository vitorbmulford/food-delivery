package com.foody.backend.orders.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DeliveryAddressRequest(
        @NotBlank @Size(max = 160) @Schema(example = "Rua das Flores") String street,
        @NotBlank @Size(max = 30) @Schema(example = "120") String number,
        @Size(max = 120) @Schema(example = "Apto 42") String complement,
        @NotBlank @Size(max = 120) @Schema(example = "Centro") String neighborhood,
        @NotBlank @Size(max = 120) @Schema(example = "São Paulo") String city,
        @NotBlank @Pattern(regexp = "[A-Za-z]{2}", message = "must contain two letters") @Schema(example = "SP") String state,
        @NotBlank @Size(max = 16) @Schema(example = "01001000") String postalCode) { }
