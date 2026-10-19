package com.foody.backend.shared.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {
    @Test
    void limitsOnlyTheSameClientAndProvidesRetryAfter() throws Exception {
        RateLimitProperties.Limit onePerHour = new RateLimitProperties.Limit(1, Duration.ofHours(1));
        RateLimitFilter filter = new RateLimitFilter(new RateLimitProperties(onePerHour, onePerHour, onePerHour, Duration.ofMinutes(1), 10), new SimpleMeterRegistry());
        assertThat(invoke(filter, "127.0.0.1").getStatus()).isEqualTo(200);
        MockHttpServletResponse rejected = invoke(filter, "127.0.0.1");
        assertThat(rejected.getStatus()).isEqualTo(429);
        assertThat(rejected.getHeader("Retry-After")).isNotBlank();
        assertThat(invoke(filter, "127.0.0.2").getStatus()).isEqualTo(200);
    }

    private MockHttpServletResponse invoke(RateLimitFilter filter, String remoteAddress) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr(remoteAddress);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
