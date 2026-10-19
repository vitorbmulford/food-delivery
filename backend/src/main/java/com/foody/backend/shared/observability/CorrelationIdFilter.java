package com.foody.backend.shared.observability;

import jakarta.servlet.FilterChain;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(CorrelationIdFilter.class);
    public static final String MDC_KEY = "correlationId";
    private static final String HEADER = "X-Correlation-ID";
    private static final Pattern VALID_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,63}");

    @Override
    @SuppressFBWarnings(value = "HRS_REQUEST_PARAMETER_TO_HTTP_HEADER", justification = "The header is admitted only after a strict ASCII allow-list and maximum-length validation; invalid values are replaced by a generated UUID.")
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String incoming = request.getHeader(HEADER);
        String correlationId = incoming != null && VALID_ID.matcher(incoming).matches() ? incoming : UUID.randomUUID().toString();
        String previous = MDC.get(MDC_KEY);
        MDC.put(MDC_KEY, correlationId);
        response.setHeader(HEADER, correlationId);
        long startedAt = System.nanoTime();
        try { chain.doFilter(request, response); }
        finally {
            long durationMs = (System.nanoTime() - startedAt) / 1_000_000;
            LOG.info("HTTP request completed correlationId={} operation=http.request method={} endpoint={} status={} durationMs={} outcome={}",
                    correlationId, request.getMethod(), endpoint(request), response.getStatus(), durationMs,
                    response.getStatus() < 400 ? "SUCCESS" : "ERROR");
            if (previous == null) MDC.remove(MDC_KEY); else MDC.put(MDC_KEY, previous);
        }
    }

    private String endpoint(HttpServletRequest request) {
        return request.getRequestURI().replaceAll("/[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}(?=/|$)", "/{id}");
    }
}
