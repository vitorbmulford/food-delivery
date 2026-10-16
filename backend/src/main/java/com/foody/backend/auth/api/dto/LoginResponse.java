package com.foody.backend.auth.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record LoginResponse(@Schema(example = "eyJhbGciOiJIUzI1NiJ9...") String accessToken,
                            @Schema(example = "Bearer") String tokenType,
                            @Schema(example = "3600") long expiresIn) {
}
