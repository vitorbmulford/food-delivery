package com.foody.backend.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtValidators;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;

class WebSocketJwtAuthenticationInterceptorTest {
    private static final byte[] SECRET = "01234567890123456789012345678901".getBytes(java.nio.charset.StandardCharsets.UTF_8);
    private final WebSocketJwtAuthenticationInterceptor interceptor = new WebSocketJwtAuthenticationInterceptor(decoder());

    @Test
    void authenticatesConnectUsingJwtSubjectAsStablePrincipalName() {
        String subject = "ff8a0f2c-d63f-47d1-88c4-6fe8aa66a50c";
        Message<?> result = interceptor.preSend(message(StompCommand.CONNECT, null, "Bearer " + token(subject)), null);

        assertThat(StompHeaderAccessor.wrap(result).getUser().getName()).isEqualTo(subject);
    }

    @Test
    void rejectsMissingOrMalformedAuthenticationAndClientSends() {
        assertThatThrownBy(() -> interceptor.preSend(message(StompCommand.CONNECT, null, null), null))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> interceptor.preSend(message(StompCommand.CONNECT, null, "Bearer altered"), null))
                .isInstanceOf(MessageDeliveryException.class);
        assertThatThrownBy(() -> interceptor.preSend(message(StompCommand.SEND, "/app/orders", null), null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void rejectsExpiredAuthentication() {
        assertThatThrownBy(() -> interceptor.preSend(message(StompCommand.CONNECT, null,
                "Bearer " + token("ff8a0f2c-d63f-47d1-88c4-6fe8aa66a50c", Instant.now().minusSeconds(60))), null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void permitsOnlyThePrivateOrderSubscriptionForAuthenticatedSessions() {
        StompHeaderAccessor connect = StompHeaderAccessor.wrap(interceptor.preSend(
                message(StompCommand.CONNECT, null, "Bearer " + token("ff8a0f2c-d63f-47d1-88c4-6fe8aa66a50c")), null));
        StompHeaderAccessor allowed = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        allowed.setDestination("/user/queue/orders");
        allowed.setUser(connect.getUser());
        assertThat(interceptor.preSend(MessageBuilder.createMessage(new byte[0], allowed.getMessageHeaders()), null)).isNotNull();

        StompHeaderAccessor forbidden = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        forbidden.setDestination("/queue/orders");
        forbidden.setUser(connect.getUser());
        assertThatThrownBy(() -> interceptor.preSend(MessageBuilder.createMessage(new byte[0], forbidden.getMessageHeaders()), null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    private Message<byte[]> message(StompCommand command, String destination, String authorization) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setLeaveMutable(true);
        if (destination != null) accessor.setDestination(destination);
        if (authorization != null) accessor.addNativeHeader("Authorization", authorization);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private JwtDecoder decoder() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(new SecretKeySpec(SECRET, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefault());
        return decoder;
    }

    private String token(String subject) {
        return token(subject, Instant.now().plusSeconds(60));
    }

    private String token(String subject, Instant expiresAt) {
        JwtEncoder encoder = new NimbusJwtEncoder(new ImmutableSecret<SecurityContext>(new SecretKeySpec(SECRET, "HmacSHA256")));
        Instant now = Instant.now();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), JwtClaimsSet.builder()
                .issuer("test").subject(subject).issuedAt(now.minusSeconds(120)).expiresAt(expiresAt).build())).getTokenValue();
    }
}
