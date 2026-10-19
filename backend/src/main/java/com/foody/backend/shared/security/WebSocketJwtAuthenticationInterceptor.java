package com.foody.backend.shared.security;

import java.util.List;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;

@Component
public class WebSocketJwtAuthenticationInterceptor implements ChannelInterceptor {
    private static final String ORDERS_DESTINATION = "/user/queue/orders";
    private final JwtDecoder jwtDecoder;

    public WebSocketJwtAuthenticationInterceptor(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            accessor = StompHeaderAccessor.wrap(message);
        }
        StompCommand command = accessor.getCommand();
        if (command == null) {
            return message; // heartbeat
        }
        if (StompCommand.CONNECT.equals(command) || StompCommand.STOMP.equals(command)) {
            accessor.setUser(authenticate(accessor.getFirstNativeHeader("Authorization")));
            return accessor.isMutable() ? message : MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
        }
        if (StompCommand.SUBSCRIBE.equals(command)) {
            requireAuthenticated(accessor);
            if (!ORDERS_DESTINATION.equals(accessor.getDestination())) {
                throw denied("Subscription destination is not permitted");
            }
            return message;
        }
        if (StompCommand.SEND.equals(command)) {
            throw denied("Client SEND frames are not permitted");
        }
        // Spring can synthesize DISCONNECT after a transport failure without session headers.
        if (StompCommand.DISCONNECT.equals(command)) {
            return message;
        }
        if (StompCommand.ACK.equals(command) || StompCommand.NACK.equals(command)) {
            requireAuthenticated(accessor);
            return message;
        }
        throw denied("STOMP command is not permitted");
    }

    private AbstractAuthenticationToken authenticate(String authorization) {
        if (!StringUtils.hasText(authorization) || !authorization.startsWith("Bearer ")) {
            throw denied("Authentication is required");
        }
        try {
            Jwt jwt = jwtDecoder.decode(authorization.substring(7));
            if (!StringUtils.hasText(jwt.getSubject())) {
                throw denied("Authentication is required");
            }
            return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_USER")), jwt.getSubject());
        } catch (org.springframework.security.oauth2.jwt.JwtException exception) {
            throw denied("Authentication is required");
        }
    }

    private void requireAuthenticated(StompHeaderAccessor accessor) {
        if (!(accessor.getUser() instanceof Authentication authentication) || !authentication.isAuthenticated()) {
            throw denied("Authentication is required");
        }
    }

    private MessageDeliveryException denied(String message) {
        return new MessageDeliveryException(message);
    }
}
