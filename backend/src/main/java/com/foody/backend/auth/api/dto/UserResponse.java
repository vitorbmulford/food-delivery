package com.foody.backend.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

public record UserResponse(@Schema(example = "e95870e8-9bc1-4e9e-8b58-477d2473b0d1") UUID id,
                           @Schema(example = "João Silva") String name,
                           @Schema(example = "joao@example.com") String email) {
}
