package com.foody.backend.shared.ratelimit;

import io.github.bucket4j.Bandwidth;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.filter.OncePerRequestFilter;

public class RateLimitFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(RateLimitFilter.class);
    private final RateLimitProperties properties;
    private final Map<String, Entry> buckets = new ConcurrentHashMap<>();
    private final MeterRegistry meterRegistry;

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "MeterRegistry is a Spring-managed shared collaborator intentionally retained by this singleton.")
    public RateLimitFilter(RateLimitProperties properties, MeterRegistry meterRegistry) { this.properties = properties; this.meterRegistry = meterRegistry; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Policy policy = policy(request);
        if (policy == null) { chain.doFilter(request, response); return; }
        evictInactive();
        Entry entry = buckets.computeIfAbsent(policy.name() + ':' + policy.key(request), ignored -> new Entry(bucket(policy.limit()), Instant.now()));
        entry.usedAt = Instant.now();
        ConsumptionProbe probe = entry.bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) { chain.doFilter(request, response); return; }
        long seconds = Math.max(1, (long) Math.ceil(probe.getNanosToWaitForRefill() / 1_000_000_000d));
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader("Retry-After", Long.toString(seconds));
        response.setContentType("application/problem+json");
        response.getWriter().write("{\"status\":429,\"detail\":\"Rate limit exceeded\"}");
        Counter.builder("rate.limit.rejected").tag("operation", policy.name()).register(meterRegistry).increment();
        LOG.warn("Rate limit exceeded operation={}", policy.name());
    }

    int bucketCount() { return buckets.size(); }

    private Policy policy(HttpServletRequest request) {
        String method = request.getMethod(); String path = request.getRequestURI();
        if ("POST".equals(method) && "/api/auth/login".equals(path)) return new Policy("auth.login", properties.login(), this::remoteAddress);
        if ("POST".equals(method) && "/api/auth/register".equals(path)) return new Policy("auth.register", properties.register(), this::remoteAddress);
        if ("POST".equals(method) && path.matches("/api/orders/[0-9a-fA-F-]+/geocode")) return new Policy("order.geocode", properties.geocoding(), this::authenticatedUser);
        return null;
    }
    private String remoteAddress(HttpServletRequest request) { return request.getRemoteAddr(); }
    private String authenticatedUser(HttpServletRequest ignored) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) return jwt.getSubject();
        return "unauthenticated-" + UUID.randomUUID();
    }
    private Bucket bucket(RateLimitProperties.Limit limit) {
        return Bucket.builder().addLimit(Bandwidth.classic(limit.capacity(), Refill.greedy(limit.capacity(), limit.period()))).build();
    }
    private void evictInactive() {
        Instant cutoff = Instant.now().minus(properties.bucketIdleTtl());
        buckets.entrySet().removeIf(entry -> entry.getValue().usedAt.isBefore(cutoff));
        int excess = buckets.size() - properties.maxBuckets();
        if (excess > 0) buckets.entrySet().stream().sorted(Comparator.comparing(entry -> entry.getValue().usedAt)).limit(excess).map(Map.Entry::getKey).toList().forEach(buckets::remove);
    }
    private record Policy(String name, RateLimitProperties.Limit limit, java.util.function.Function<HttpServletRequest, String> keyFunction) { String key(HttpServletRequest request) { return keyFunction.apply(request); } }
    private static final class Entry { private final Bucket bucket; private volatile Instant usedAt; private Entry(Bucket bucket, Instant usedAt) { this.bucket = bucket; this.usedAt = usedAt; } }
}
