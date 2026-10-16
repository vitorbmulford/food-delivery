package com.foody.backend.auth.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.foody.backend.auth.api.dto.RegisterRequest;
import com.foody.backend.auth.domain.User;
import com.foody.backend.auth.infrastructure.persistence.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class UserRegistrationServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private final UserRegistrationService service = new UserRegistrationService(users, encoder,
            Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC));

    @Test
    void registersNormalizedEmailWithPasswordHash() {
        when(users.existsByEmail("joao@example.com")).thenReturn(false);
        when(users.saveAndFlush(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.register(new RegisterRequest(" João Silva ", " JOAO@EXAMPLE.COM ", "SenhaSegura123!"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).saveAndFlush(saved.capture());
        assertEquals("joao@example.com", response.email());
        assertEquals("João Silva", response.name());
        assertFalse(saved.getValue().getPasswordHash().contains("SenhaSegura123!"));
        assertEquals(true, encoder.matches("SenhaSegura123!", saved.getValue().getPasswordHash()));
    }

    @Test
    void rejectsExistingEmail() {
        when(users.existsByEmail("joao@example.com")).thenReturn(true);
        assertThrows(EmailAlreadyRegisteredException.class,
                () -> service.register(new RegisterRequest("João", "joao@example.com", "SenhaSegura123!")));
    }
}
