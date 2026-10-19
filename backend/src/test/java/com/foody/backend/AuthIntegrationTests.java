package com.foody.backend;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.foody.backend.auth.domain.User;
import com.foody.backend.auth.infrastructure.persistence.UserRepository;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthIntegrationTests {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Autowired
    private UserRepository users;

    @Test
    void registerLoginAndGetCurrentUser() throws Exception {
        String registration = "{\"name\":\"João Silva\",\"email\":\"JOAO@example.com\",\"password\":\"SenhaSegura123!\"}";
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("joao@example.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(registration))
                .andExpect(status().isConflict());

        String login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"joao@example.com\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(login, "$.accessToken");
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value("joao@example.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void rejectsInvalidCredentialsAndTokens() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"none@example.com\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer invalid.token.value"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void restoresAndRenewsSessionUntilExplicitLogout() throws Exception {
        register("persistent-session@example.com");
        var loginResult = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"persistent-session@example.com\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isOk())
                .andReturn();

        Cookie sessionCookie = loginResult.getResponse().getCookie("FOODY_SESSION");
        assertNotNull(sessionCookie);
        assertTrue(sessionCookie.isHttpOnly());
        String accessToken = JsonPath.read(loginResult.getResponse().getContentAsString(), "$.accessToken");
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());

        mvc.perform(post("/api/auth/refresh").cookie(sessionCookie))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty());
        mvc.perform(post("/api/auth/logout").cookie(sessionCookie))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/refresh").cookie(sessionCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsWrongPasswordForExistingUser() throws Exception {
        register("password-test@example.com");

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"password-test@example.com\",\"password\":\"SenhaIncorreta123!\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsExpiredJwt() throws Exception {
        String token = token(jwtEncoder, "expired-user", Instant.now().minusSeconds(7200), Instant.now().minusSeconds(3600));

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsTamperedJwt() throws Exception {
        String token = loginAfterRegister("tampered-token@example.com");
        int signatureStart = token.lastIndexOf('.') + 1;
        char replacement = token.charAt(signatureStart) == 'A' ? 'B' : 'A';
        String tampered = token.substring(0, signatureStart) + replacement + token.substring(signatureStart + 1);

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsJwtSignedWithDifferentKey() throws Exception {
        JwtEncoder differentKeyEncoder = new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(
                new SecretKeySpec("different-test-secret-with-at-least-32-bytes".getBytes(), "HmacSHA256")));
        String token = token(differentKeyEncoder, "different-key-user", Instant.now(), Instant.now().plusSeconds(3600));

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void databaseEnforcesUniqueEmailConstraint() {
        String email = "database-unique@example.com";
        users.saveAndFlush(new User(UUID.randomUUID(), "First", email, "hash", Instant.now()));

        assertThrows(DataIntegrityViolationException.class,
                () -> users.saveAndFlush(new User(UUID.randomUUID(), "Second", email, "hash", Instant.now())));
    }

    private void register(String email) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test User\",\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isCreated());
    }

    private String loginAfterRegister(String email) throws Exception {
        register(email);
        String response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }

    private String token(JwtEncoder encoder, String subject, Instant issuedAt, Instant expiresAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("foody-delivery-test")
                .subject(subject).issuedAt(issuedAt).expiresAt(expiresAt).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
}
