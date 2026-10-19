package com.foody.backend.geocoding.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.foody.backend.geocoding.domain.GeocodingStatus;
import com.foody.backend.orders.domain.DeliveryAddress;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class NominatimGeocodingClientTest {
    private final AtomicReference<Response> response = new AtomicReference<>();
    private HttpServer server;
    private NominatimGeocodingClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/search", this::respond);
        server.start();
        client = new NominatimGeocodingClient(new NominatimProperties("http://localhost:" + server.getAddress().getPort(),
                "foody-delivery-test/1.0 (contact: test@example.com)", Duration.ofMillis(100), Duration.ofMillis(100)));
    }

    @AfterEach
    void tearDown() { server.stop(0); }

    @Test
    void returnsCoordinatesForValidResponse() {
        response.set(new Response(200, "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]", 0));
        var result = client.geocode(address());
        assertThat(result.status()).isEqualTo(GeocodingStatus.SUCCESS);
        assertThat(result.coordinates().latitude()).isEqualByComparingTo("-23.5614");
    }

    @Test
    void returnsNotFoundForEmptyResponse() {
        response.set(new Response(200, "[]", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.NOT_FOUND);
    }

    @Test
    void returnsFailedForRateLimitAndServerErrors() {
        response.set(new Response(429, "too many requests", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
        response.set(new Response(500, "server error", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
    }

    @Test
    void returnsFailedForTimeoutAndInvalidJson() {
        response.set(new Response(200, "[]", 250));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
        response.set(new Response(200, "not-json", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
    }

    @Test
    void returnsFailedForInvalidCoordinates() {
        response.set(new Response(200, "[{\"lat\":\"91\",\"lon\":\"-46\"}]", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
        response.set(new Response(200, "[{\"lat\":\"-23\",\"lon\":\"181\"}]", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
    }

    @Test
    void parsesFutureHttpDateRetryAfterAgainstProvidedClock() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-18T12:00:00Z"), ZoneOffset.UTC);
        String value = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.parse("2026-10-18T12:00:30Z").atZone(ZoneOffset.UTC));

        assertThat(NominatimGeocodingClient.parseRetryAfter(value, clock)).isEqualTo(Duration.ofSeconds(30));
    }

    @Test
    void parsesPastAndInvalidHttpDateRetryAfterWithoutAddingWait() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-18T12:00:00Z"), ZoneOffset.UTC);
        String past = DateTimeFormatter.RFC_1123_DATE_TIME.format(Instant.parse("2026-10-18T11:59:00Z").atZone(ZoneOffset.UTC));

        assertThat(NominatimGeocodingClient.parseRetryAfter(past, clock)).isEqualTo(Duration.ZERO);
        assertThat(NominatimGeocodingClient.parseRetryAfter("not-a-date-or-seconds", clock)).isNull();
    }

    @Test
    void parsesNumericRetryAfterAndKeepsExcessiveValuesForBudgetPolicy() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-18T12:00:00Z"), ZoneOffset.UTC);

        assertThat(NominatimGeocodingClient.parseRetryAfter("61", clock)).isEqualTo(Duration.ofSeconds(61));
        assertThat(NominatimGeocodingClient.parseRetryAfter("-1", clock)).isNull();
    }

    private void respond(HttpExchange exchange) throws IOException {
        Response current = response.get();
        try {
            Thread.sleep(current.delayMillis());
            byte[] payload = current.body().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(current.status(), payload.length);
            exchange.getResponseBody().write(payload);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        } finally {
            exchange.close();
        }
    }

    private DeliveryAddress address() { return new DeliveryAddress("Avenida Paulista", "1578", null, "Bela Vista", "São Paulo", "SP", "01310200"); }
    private record Response(int status, String body, long delayMillis) { }
}
