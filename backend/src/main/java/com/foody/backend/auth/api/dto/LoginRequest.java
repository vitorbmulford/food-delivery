package com.foody.backend.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank @Email @Size(max = 320) @Schema(example = "joao@example.com") String email,
        @NotBlank @Size(max = 72) @Schema(example = "SenhaSegura123!") String password) {
}
