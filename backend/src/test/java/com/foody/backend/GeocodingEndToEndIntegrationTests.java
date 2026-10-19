package com.foody.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.foody.backend.geocoding.application.GeocodingService;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.List;
import java.util.ArrayList;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.ReflectionTestUtils;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class GeocodingEndToEndIntegrationTests {
    private static final String HTTP_DATE_AFTER_PREFIX = "__HTTP_DATE_AFTER_SECONDS__:";
    private static final AtomicInteger REQUESTS = new AtomicInteger();
    private static final ConcurrentLinkedQueue<Response> RESPONSES = new ConcurrentLinkedQueue<>();
    private static final ConcurrentLinkedQueue<Long> ARRIVALS = new ConcurrentLinkedQueue<>();
    private static final HttpServer NOMINATIM = startNominatim();
    private static final String ORDER = """
            {"items":[{"productName":"Hambúrguer Artesanal","quantity":2,"unitPrice":32.90}],
            "deliveryAddress":{"street":"Avenida Paulista","number":"1578","neighborhood":"Bela Vista","city":"São Paulo","state":"SP","postalCode":"01310200"}}""";

    @Autowired private MockMvc mvc;
    @Autowired private MeterRegistry meterRegistry;
    @Autowired private GeocodingService geocodingService;

    @DynamicPropertySource
    static void nominatimProperties(DynamicPropertyRegistry registry) {
        registry.add("geocoding.nominatim.base-url", () -> "http://localhost:" + NOMINATIM.getAddress().getPort());
        registry.add("geocoding.nominatim.user-agent", () -> "foody-delivery-test/1.0 (contact: test@example.com)");
    }

    @AfterAll
    static void stopNominatim() { NOMINATIM.stop(0); }

    @org.junit.jupiter.api.BeforeEach
    void resetNominatim() {
        REQUESTS.set(0);
        RESPONSES.clear();
        ARRIVALS.clear();
        circuitBreaker().reset();
    }

    @Test
    void createsGeocodesPersistsAndReturnsCoordinatesWithoutDuplicateReprocessing() throws Exception {
        String token = tokenFor("geocoding-e2e@example.com");
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER))
                .andExpect(status().isCreated()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        String response = awaitSuccess(token, id);
        assertThat(JsonPath.read(response, "$.coordinates.latitude").toString()).isEqualTo("-23.5614");
        assertThat(JsonPath.read(response, "$.coordinates.longitude").toString()).isEqualTo("-46.6559");
        assertThat(REQUESTS.get()).isEqualTo(1);

        mvc.perform(post("/api/orders/{id}/geocode", id).header("Authorization", bearer(token)))
                .andExpect(status().isAccepted());
        Thread.sleep(250);
        assertThat(REQUESTS.get()).isEqualTo(1);
    }

    @Test
    void usesValidatedStreetFallbackOnlyAsAnUnconfirmedSuggestion() throws Exception {
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, streetResult(), null));
        String token = tokenFor("street-fallback@example.com");

        String response = awaitStatus(token, createOrder(token), "NOT_FOUND", 50);

        assertThat((Object) JsonPath.read(response, "$.coordinates")).isNull();
        assertThat(String.valueOf((Object) JsonPath.read(response, "$.geocodingSuggestionLevel")))
                .isEqualTo("STREET");
        assertThat(JsonPath.read(response, "$.suggestedCoordinates.latitude").toString()).isEqualTo("-23.5614");
        assertThat(REQUESTS.get()).isEqualTo(2);
    }

    @Test
    void progressesToNeighborhoodFallbackWhenStreetIsNotFound() throws Exception {
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, neighborhoodResult(), null));
        String token = tokenFor("neighborhood-fallback@example.com");

        String response = awaitStatus(token, createOrder(token), "NOT_FOUND", 60);

        assertThat(String.valueOf((Object) JsonPath.read(response, "$.geocodingSuggestionLevel")))
                .isEqualTo("NEIGHBORHOOD");
        assertThat((Object) JsonPath.read(response, "$.coordinates")).isNull();
        assertThat(REQUESTS.get()).isEqualTo(3);
    }

    @Test
    void progressesToPostalCodeFallbackAndKeepsItApproximate() throws Exception {
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, postalCodeResult("01310-200"), null));
        String token = tokenFor("postal-fallback@example.com");

        String response = awaitStatus(token, createOrder(token), "NOT_FOUND", 70);

        assertThat(String.valueOf((Object) JsonPath.read(response, "$.geocodingSuggestionLevel")))
                .isEqualTo("POSTAL_CODE");
        assertThat((Object) JsonPath.read(response, "$.coordinates")).isNull();
        assertThat(REQUESTS.get()).isEqualTo(4);
    }

    @Test
    void rejectsIncompatiblePostalFallbackAndLeavesOrderFunctionalWithoutSuggestion() throws Exception {
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, postalCodeResult("99999-999"), null));
        String token = tokenFor("rejected-postal-fallback@example.com");

        String response = awaitStatus(token, createOrder(token), "NOT_FOUND", 70);

        assertThat((Object) JsonPath.read(response, "$.coordinates")).isNull();
        assertThat((Object) JsonPath.read(response, "$.suggestedCoordinates")).isNull();
        assertThat((Object) JsonPath.read(response, "$.geocodingSuggestionLevel")).isNull();
        assertThat(REQUESTS.get()).isEqualTo(4);
    }

    @Test
    void retriesOnlyTheFallbackLevelThatFailedTransiently() throws Exception {
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(200, "[]", null));
        RESPONSES.add(new Response(503, "temporarily unavailable", null));
        RESPONSES.add(new Response(200, postalCodeResult("01310-200"), null));
        String token = tokenFor("postal-retry-fallback@example.com");

        String response = awaitStatus(token, createOrder(token), "NOT_FOUND", 90);

        assertThat(String.valueOf((Object) JsonPath.read(response, "$.geocodingSuggestionLevel")))
                .isEqualTo("POSTAL_CODE");
        assertThat(REQUESTS.get()).as("three earlier levels plus the retried postal level").isEqualTo(5);
    }

    @Test
    void laterNominatimResponseDoesNotOverwriteManuallyConfirmedCoordinates() throws Exception {
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 500));
        String token = tokenFor("manual-location-race@example.com");
        String id = createOrder(token);

        mvc.perform(patch("/api/orders/{id}/location", id).header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\":-23.550520,\"longitude\":-46.633309}"))
                .andExpect(status().isOk());

        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        while (REQUESTS.get() == 0 && System.nanoTime() < deadline) {
            Thread.sleep(50);
        }
        assertThat(REQUESTS.get()).isEqualTo(1);
        Thread.sleep(600);

        mvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.coordinates.latitude").value(-23.550520))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.coordinates.longitude").value(-46.633309))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.coordinateSource").value("MANUAL"));
    }

    @Test
    void retriesTransient503ThenPersistsCoordinates() throws Exception {
        double durationCount = timerCount("SUCCESS");
        RESPONSES.add(new Response(503, "temporarily unavailable", null));
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null));
        String token = tokenFor("retry-503@example.com");
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER))
                .andExpect(status().isCreated()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        String response = awaitSuccess(token, id);
        assertThat(String.valueOf((Object) JsonPath.read(response, "$.geocodingStatus"))).isEqualTo("SUCCESS");
        assertThat(REQUESTS.get()).isEqualTo(2);
        assertThat(timerCount("SUCCESS")).isGreaterThan(durationCount);
    }

    @Test
    void doesNotRetryPermanent403MarksFailedAndLogsProviderStatus(CapturedOutput output) throws Exception {
        double durationCount = timerCount("FAILED");
        RESPONSES.add(new Response(403, "access denied", null));
        String token = tokenFor("permanent-403@example.com");
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER))
                .andExpect(status().isCreated()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        String response = awaitStatus(token, id, "FAILED");
        assertThat(String.valueOf((Object) JsonPath.read(response, "$.geocodingStatus"))).isEqualTo("FAILED");
        assertThat(REQUESTS.get()).isEqualTo(1);
        assertThat(timerCount("FAILED")).isGreaterThan(durationCount);
        assertThat(output).contains("Geocoding provider failure orderId=" + id)
                .contains("status=403")
                .contains("transient=false");
    }

    @Test
    void honorsNumericRetryAfterAndGlobalOneRequestPerSecond() throws Exception {
        RESPONSES.add(new Response(429, "busy", "1", 0));
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 0));
        String token = tokenFor("retry-429@example.com");
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER)).andExpect(status().isCreated()).andReturn();
        awaitSuccess(token, JsonPath.read(created.getResponse().getContentAsString(), "$.id"));
        List<Long> arrivals = new ArrayList<>(ARRIVALS);
        assertThat(arrivals).hasSize(2);
        assertThat(arrivals.get(1) - arrivals.get(0)).isGreaterThanOrEqualTo(900);
    }

    @Test
    void timeoutIsRetriedAndRecovers() throws Exception {
        RESPONSES.add(new Response(200, "[]", null, 100));
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 0));
        String token = tokenFor("timeout-retry@example.com");
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER)).andExpect(status().isCreated()).andReturn();
        awaitSuccess(token, JsonPath.read(created.getResponse().getContentAsString(), "$.id"));
        assertThat(REQUESTS.get()).isEqualTo(2);
    }

    @Test
    void concurrentGeocodingOperationsAndRetryShareOneGlobalPermitSchedule() throws Exception {
        RESPONSES.add(new Response(503, "temporarily unavailable", null, 0));
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 0));
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 0));
        String token = tokenFor("global-geocoding-limit@example.com");

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService submitters = Executors.newFixedThreadPool(2);
        try {
            Future<String> firstOrder = submitters.submit(() -> createOrderAfterStart(token, ready, start));
            Future<String> secondOrder = submitters.submit(() -> createOrderAfterStart(token, ready, start));
            assertThat(ready.await(5, TimeUnit.SECONDS)).as("both independent operations reach the start gate").isTrue();
            start.countDown();

            String firstId = firstOrder.get(10, TimeUnit.SECONDS);
            String secondId = secondOrder.get(10, TimeUnit.SECONDS);
            awaitSuccess(token, firstId);
            awaitSuccess(token, secondId);

            assertThat(REQUESTS.get()).as("one transient failure is retried and both operations succeed").isEqualTo(3);
            List<Long> arrivals = new ArrayList<>(ARRIVALS);
            arrivals.sort(Long::compareTo);
            assertThat(arrivals).hasSize(3);
            List<Long> intervalsMillis = new ArrayList<>();
            for (int index = 1; index < arrivals.size(); index++) {
                long intervalMillis = TimeUnit.NANOSECONDS.toMillis(arrivals.get(index) - arrivals.get(index - 1));
                intervalsMillis.add(intervalMillis);
                assertThat(intervalMillis)
                        .as("global limiter spacing between provider arrivals %s and %s", index, index + 1)
                        .isGreaterThanOrEqualTo(900);
            }
            System.out.println("Concurrent geocoding provider arrival intervals (ms): " + intervalsMillis);
        } finally {
            start.countDown();
            submitters.shutdownNow();
        }
    }

    private String createOrderAfterStart(String token, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) throw new AssertionError("Concurrent order start was not released");
        return createOrder(token);
    }

    @Test
    void honorsFutureHttpDateRetryAfter() throws Exception {
        String token = tokenFor("retry-after-future-date@example.com");
        String retryAfter = HTTP_DATE_AFTER_PREFIX + "4";
        RESPONSES.add(new Response(429, "busy", retryAfter, 0));
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 0));
        String orderId = createOrder(token);
        awaitStatus(token, orderId, "SUCCESS", 50);
        assertArrivalInterval(2_700, 5_000);
    }

    @Test
    void pastHttpDateRetryAfterFallsBackToOneRetryWithoutAdditionalDelay() throws Exception {
        String retryAfter = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.now().minusSeconds(10).atZone(ZoneOffset.UTC));
        assertRetryAfterBehavior(retryAfter, "retry-after-past-date@example.com", 900, 4_000);
    }

    @Test
    void invalidRetryAfterFallsBackToOneRetryWithoutAdditionalDelay() throws Exception {
        assertRetryAfterBehavior("not-a-date-or-seconds", "retry-after-invalid@example.com", 900, 4_000);
    }

    @Test
    void excessiveNumericRetryAfterDoesNotWaitBeyondBudget() throws Exception {
        assertRetryAfterBehavior("61", "retry-after-excessive-seconds@example.com", 900, 4_000);
    }

    @Test
    void futureHttpDateBeyondBudgetDoesNotWaitBeyondBudget() throws Exception {
        String retryAfter = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.now().plusSeconds(120).atZone(ZoneOffset.UTC));
        assertRetryAfterBehavior(retryAfter, "retry-after-excessive-date@example.com", 900, 4_000);
    }

    private void assertRetryAfterBehavior(String retryAfter, String email, long minimumIntervalMillis,
                                          long maximumIntervalMillis) throws Exception {
        RESPONSES.add(new Response(429, "busy", retryAfter, 0));
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 0));
        String token = tokenFor(email);
        String orderId = createOrder(token);
        awaitSuccess(token, orderId);

        assertThat(REQUESTS.get()).as("one 429 response followed by one successful retry").isEqualTo(2);
        assertArrivalInterval(minimumIntervalMillis, maximumIntervalMillis);
    }

    private void assertArrivalInterval(long minimumIntervalMillis, long maximumIntervalMillis) {
        List<Long> arrivals = new ArrayList<>(ARRIVALS);
        assertThat(arrivals).hasSize(2);
        long intervalMillis = TimeUnit.NANOSECONDS.toMillis(arrivals.get(1) - arrivals.get(0));
        assertThat(intervalMillis).isBetween(minimumIntervalMillis, maximumIntervalMillis);
    }

    @Test
    void circuitBreakerOpensRejectsRecoversAndReopensUsingWholeRetryOperations() throws Exception {
        CircuitBreaker circuitBreaker = circuitBreaker();
        ConcurrentLinkedQueue<CircuitBreaker.StateTransition> transitions = new ConcurrentLinkedQueue<>();
        circuitBreaker.getEventPublisher().onStateTransition(event -> transitions.add(event.getStateTransition()));

        // Two logical operations fail. Each has two HTTP attempts, but only the two final failures count to the breaker.
        RESPONSES.add(new Response(503, "down", null, 0)); RESPONSES.add(new Response(503, "down", null, 0));
        RESPONSES.add(new Response(503, "down", null, 0)); RESPONSES.add(new Response(503, "down", null, 0));
        String token = tokenFor("breaker-cycle@example.com");
        String first = createOrder(token); awaitStatus(token, first, "FAILED");
        assertThat(circuitBreaker.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
        String second = createOrder(token); awaitStatus(token, second, "FAILED");
        assertThat(REQUESTS.get()).isEqualTo(4);
        assertThat(circuitBreaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);

        String rejected = createOrder(token); awaitStatus(token, rejected, "FAILED");
        assertThat(REQUESTS.get()).as("OPEN breaker must not call the provider").isEqualTo(4);

        awaitOpenStateExpiry();
        RESPONSES.add(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null, 0));
        String recovered = createOrder(token); awaitSuccess(token, recovered);
        assertThat(REQUESTS.get()).isEqualTo(5);
        assertThat(circuitBreaker.getState()).isEqualTo(CircuitBreaker.State.CLOSED);

        RESPONSES.add(new Response(503, "down", null, 0)); RESPONSES.add(new Response(503, "down", null, 0));
        RESPONSES.add(new Response(503, "down", null, 0)); RESPONSES.add(new Response(503, "down", null, 0));
        awaitStatus(token, createOrder(token), "FAILED"); awaitStatus(token, createOrder(token), "FAILED");
        assertThat(circuitBreaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);
        int beforeHalfOpenFailure = REQUESTS.get();
        awaitOpenStateExpiry();
        RESPONSES.add(new Response(503, "down", null, 0)); RESPONSES.add(new Response(503, "down", null, 0));
        awaitStatus(token, createOrder(token), "FAILED");
        assertThat(REQUESTS.get()).isGreaterThan(beforeHalfOpenFailure);
        assertThat(circuitBreaker.getState()).isEqualTo(CircuitBreaker.State.OPEN);
        int openAgain = REQUESTS.get();
        awaitStatus(token, createOrder(token), "FAILED");
        assertThat(REQUESTS.get()).isEqualTo(openAgain);
        assertThat(transitions).contains(
                CircuitBreaker.StateTransition.CLOSED_TO_OPEN,
                CircuitBreaker.StateTransition.OPEN_TO_HALF_OPEN,
                CircuitBreaker.StateTransition.HALF_OPEN_TO_CLOSED,
                CircuitBreaker.StateTransition.HALF_OPEN_TO_OPEN);
    }

    private CircuitBreaker circuitBreaker() {
        return (CircuitBreaker) ReflectionTestUtils.getField(geocodingService, "circuitBreaker");
    }

    private void awaitOpenStateExpiry() throws InterruptedException {
        // The test profile uses 250 ms; this controlled interval lets the real breaker enter HALF_OPEN lazily.
        TimeUnit.MILLISECONDS.sleep(300);
    }

    private String createOrder(String token) throws Exception {
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER)).andExpect(status().isCreated()).andReturn();
        return JsonPath.read(created.getResponse().getContentAsString(), "$.id");
    }

    private String awaitSuccess(String token, String id) throws Exception {
        return awaitStatus(token, id, "SUCCESS");
    }

    private String awaitStatus(String token, String id, String expected) throws Exception {
        return awaitStatus(token, id, expected, 30);
    }

    private String awaitStatus(String token, String id, String expected, int maxAttempts) throws Exception {
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            MvcResult result = mvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(token)))
                    .andExpect(status().isOk()).andReturn();
            String body = result.getResponse().getContentAsString();
            if (expected.equals(JsonPath.read(body, "$.geocodingStatus"))) {
                return body;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Geocoding did not finish with " + expected);
    }

    private String tokenFor(String email) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Geocoding User\",\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isCreated());
        MvcResult login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
    }

    private static HttpServer startNominatim() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
            server.createContext("/search", exchange -> {
                REQUESTS.incrementAndGet();
                ARRIVALS.add(System.nanoTime());
                Response response = RESPONSES.poll();
                if (response == null) response = new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", null);
                if (response.delayMillis() > 0) {
                    try { Thread.sleep(response.delayMillis()); }
                    catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
                }
                if (response.retryAfter() != null) {
                    String retryAfter = response.retryAfter();
                    if (retryAfter.startsWith(HTTP_DATE_AFTER_PREFIX)) {
                        long seconds = Long.parseLong(retryAfter.substring(HTTP_DATE_AFTER_PREFIX.length()));
                        retryAfter = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.now().plusSeconds(seconds).atZone(ZoneOffset.UTC));
                    }
                    exchange.getResponseHeaders().add("Retry-After", retryAfter);
                }
                byte[] body = response.body().getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(response.status(), body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to start local Nominatim server", exception);
        }
    }

    private String bearer(String token) { return "Bearer " + token; }
    private String streetResult() {
        return """
                [{"lat":"-23.5614","lon":"-46.6559","address":{"road":"Avenida Paulista",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """;
    }
    private String neighborhoodResult() {
        return """
                [{"lat":"-23.5600","lon":"-46.6500","address":{"suburb":"Bela Vista",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """;
    }
    private String postalCodeResult(String postalCode) {
        return """
                [{"lat":"-23.5600","lon":"-46.6500","address":{"postcode":"%s",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """.formatted(postalCode);
    }
    private double timerCount(String outcome) {
        Timer timer = meterRegistry.find("geocoding.duration").tag("outcome", outcome).timer();
        return timer == null ? 0 : timer.count();
    }
    private record Response(int status, String body, String retryAfter, long delayMillis) {
        private Response(int status, String body, String retryAfter) { this(status, body, retryAfter, 0); }
    }
}
