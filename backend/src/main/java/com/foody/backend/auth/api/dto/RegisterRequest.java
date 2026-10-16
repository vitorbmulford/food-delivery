package com.foody.backend.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "Data required to create an account. Passwords need 8+ characters, an uppercase letter, a lowercase letter, a digit, and a symbol.")
public record RegisterRequest(
        @NotBlank @Size(max = 120) @Schema(example = "João Silva") String name,
        @NotBlank @Email @Size(max = 320) @Schema(example = "joao@example.com") String email,
        @NotBlank @Size(min = 8, max = 72)
        @Pattern(regexp = "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+", message = "must contain uppercase, lowercase, digit and symbol")
        @Schema(example = "SenhaSegura123!") String password) {
}
