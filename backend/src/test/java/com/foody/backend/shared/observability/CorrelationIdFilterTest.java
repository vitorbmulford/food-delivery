package com.foody.backend.shared.observability;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorrelationIdFilterTest {
    private final CorrelationIdFilter filter = new CorrelationIdFilter();

    @AfterEach void clean() { MDC.clear(); }

    @Test
    void preservesSafeIdentifierAndCleansMdc() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/orders");
        request.addHeader("X-Correlation-ID", "order-42.safe");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> assertThat(MDC.get("correlationId")).isEqualTo("order-42.safe"));
        assertThat(response.getHeader("X-Correlation-ID")).isEqualTo("order-42.safe");
        assertThat(MDC.get("correlationId")).isNull();
    }

    @Test
    void replacesLogInjectionIdentifier() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/health");
        request.addHeader("X-Correlation-ID", "unsafe\r\nvalue");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        assertThat(response.getHeader("X-Correlation-ID")).matches("[a-f0-9-]{36}");
    }
}
