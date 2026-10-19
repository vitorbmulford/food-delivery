package com.foody.backend.auth.api;

import com.foody.backend.auth.api.dto.LoginRequest;
import com.foody.backend.auth.api.dto.LoginResponse;
import com.foody.backend.auth.api.dto.RegisterRequest;
import com.foody.backend.auth.api.dto.UserResponse;
import com.foody.backend.auth.application.AuthenticationService;
import com.foody.backend.auth.application.UserRegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Authentication")
public class AuthController {
    private static final String SESSION_COOKIE = "FOODY_SESSION";

    private final UserRegistrationService registrationService;
    private final AuthenticationService authenticationService;
    private final boolean secureCookie;

    public AuthController(
            UserRegistrationService registrationService,
            AuthenticationService authenticationService,
            @Value("${auth.cookie.secure:false}") boolean secureCookie) {
        this.registrationService = registrationService;
        this.authenticationService = authenticationService;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/register")
    @Operation(summary = "Register a user")
    @ApiResponse(responseCode = "201", description = "User created")
    @ApiResponse(responseCode = "400", description = "Invalid request")
    @ApiResponse(responseCode = "409", description = "Email already registered")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserResponse user = registrationService.register(request);
        return ResponseEntity.created(URI.create("/api/users/" + user.id())).body(user);
    }

    @PostMapping("/login")
    @Operation(summary = "Authenticate and obtain a JWT")
    @ApiResponse(responseCode = "200", description = "Authenticated")
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            @CookieValue(name = SESSION_COOKIE, required = false) String previousRefreshToken) {
        var session = authenticationService.login(request, previousRefreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie(session.refreshToken()).toString())
                .body(session.loginResponse());
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh an access token using the persistent session cookie")
    @ApiResponse(responseCode = "200", description = "Access token refreshed")
    @ApiResponse(responseCode = "401", description = "Missing or invalid session")
    public ResponseEntity<LoginResponse> refresh(
            @CookieValue(name = SESSION_COOKIE, required = false) String refreshToken) {
        LoginResponse response = authenticationService.refresh(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie(refreshToken).toString())
                .body(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke the current persistent session")
    @ApiResponse(responseCode = "204", description = "Session revoked")
    public ResponseEntity<Void> logout(
            @CookieValue(name = SESSION_COOKIE, required = false) String refreshToken) {
        authenticationService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expiredSessionCookie().toString())
                .build();
    }

    private ResponseCookie sessionCookie(String refreshToken) {
        return ResponseCookie.from(SESSION_COOKIE, refreshToken)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(Duration.ofDays(400))
                .build();
    }

    private ResponseCookie expiredSessionCookie() {
        return ResponseCookie.from(SESSION_COOKIE, "")
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(Duration.ZERO)
                .build();
    }
}
