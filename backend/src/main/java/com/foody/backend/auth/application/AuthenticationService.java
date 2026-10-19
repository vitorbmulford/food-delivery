package com.foody.backend.auth.application;

import com.foody.backend.auth.api.dto.AuthenticatedSession;
import com.foody.backend.auth.api.dto.LoginRequest;
import com.foody.backend.auth.api.dto.LoginResponse;
import com.foody.backend.auth.domain.AuthSession;
import com.foody.backend.auth.infrastructure.persistence.AuthSessionRepository;
import com.foody.backend.auth.infrastructure.security.JwtProperties;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthenticationService {
    private final AuthenticationManager authenticationManager;
    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;
    private final AuthSessionRepository sessions;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthenticationService(
            AuthenticationManager authenticationManager,
            JwtEncoder jwtEncoder,
            JwtProperties jwtProperties,
            AuthSessionRepository sessions) {
        this.authenticationManager = authenticationManager;
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
        this.sessions = sessions;
    }

    @Transactional
    public AuthenticatedSession login(LoginRequest request, String previousRefreshToken) {
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(
                        UserRegistrationService.normalizeEmail(request.email()), request.password()));
        UUID userId = UUID.fromString(authentication.getName());
        logout(previousRefreshToken);
        String refreshToken = createRefreshToken();
        Instant now = Instant.now();
        sessions.save(new AuthSession(UUID.randomUUID(), userId, hashToken(refreshToken), now, now));
        return new AuthenticatedSession(issueAccessToken(userId), refreshToken);
    }

    @Transactional
    public LoginResponse refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) throw invalidSession();
        AuthSession session = sessions.findByTokenHash(hashToken(refreshToken)).orElseThrow(this::invalidSession);
        session.markUsedAt(Instant.now());
        return issueAccessToken(session.getUserId());
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) sessions.deleteByTokenHash(hashToken(refreshToken));
    }

    private LoginResponse issueAccessToken(UUID userId) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(jwtProperties.expirationSeconds());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(jwtProperties.issuer())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(userId.toString())
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new LoginResponse(token, "Bearer", jwtProperties.expirationSeconds());
    }

    private String createRefreshToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private ResponseStatusException invalidSession() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or revoked session");
    }
}
