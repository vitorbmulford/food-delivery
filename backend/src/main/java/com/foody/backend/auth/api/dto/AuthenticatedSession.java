package com.foody.backend.auth.api.dto;

public record AuthenticatedSession(LoginResponse loginResponse, String refreshToken) {
}
