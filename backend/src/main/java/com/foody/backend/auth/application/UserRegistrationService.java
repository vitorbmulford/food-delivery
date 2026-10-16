package com.foody.backend.auth.application;

import com.foody.backend.auth.api.dto.RegisterRequest;
import com.foody.backend.auth.api.dto.UserResponse;
import com.foody.backend.auth.domain.User;
import com.foody.backend.auth.infrastructure.persistence.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class UserRegistrationService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    @Autowired
    public UserRegistrationService(UserRepository users, PasswordEncoder passwordEncoder) {
        this(users, passwordEncoder, Clock.systemUTC());
    }

    UserRegistrationService(UserRepository users, PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @Transactional
    public UserResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (users.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException();
        }
        User user = new User(UUID.randomUUID(), request.name().trim(), email,
                passwordEncoder.encode(request.password()), Instant.now(clock));
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw new EmailAlreadyRegisteredException();
        }
        return new UserResponse(user.getId(), user.getName(), user.getEmail());
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
