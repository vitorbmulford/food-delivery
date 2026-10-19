package com.foody.backend.geocoding.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.foody.backend.geocoding.domain.GeocodingStatus;
import com.foody.backend.geocoding.domain.GeocodingSuggestionLevel;
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
    private final AtomicReference<String> requestQuery = new AtomicReference<>();
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
    void returnsStreetSuggestionOnlyWhenStreetCityStateAndCountryMatch() {
        response.set(new Response(200, """
                [{"lat":"-23.5614","lon":"-46.6559","address":{"road":"Avenida Paulista",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """, 0));

        var result = client.geocodeStreetSuggestionOrThrow(address());

        assertThat(result.status()).isEqualTo(GeocodingStatus.NOT_FOUND);
        assertThat(result.suggestionLevel()).isEqualTo(GeocodingSuggestionLevel.STREET);
        assertThat(result.suggestedCoordinates().latitude()).isEqualByComparingTo("-23.5614");
        assertThat(requestQuery.get()).contains("limit=5", "addressdetails=1", "countrycodes=br")
                .doesNotContain("1578", "01310200");
    }

    @Test
    void rejectsStreetSuggestionFromAnIncompatibleCityOrStreet() {
        response.set(new Response(200, """
                [{"lat":"-22.9","lon":"-43.2","address":{"road":"Avenida Paulista",
                "city":"Rio de Janeiro","state":"Rio de Janeiro","ISO3166-2-lvl4":"BR-RJ","country_code":"br"}},
                {"lat":"-23.5","lon":"-46.6","address":{"road":"Rua Augusta",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """, 0));

        var result = client.geocodeStreetSuggestionOrThrow(address());

        assertThat(result.status()).isEqualTo(GeocodingStatus.NOT_FOUND);
        assertThat(result.suggestedCoordinates()).isNull();
    }

    @Test
    void validatesNeighborhoodAndPostalCodeSuggestionsAgainstTheExpectedRegion() {
        response.set(new Response(200, """
                [{"lat":"-23.56","lon":"-46.65","address":{"suburb":"Bela Vista",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """, 0));
        assertThat(client.geocodeNeighborhoodSuggestionOrThrow(address()).suggestionLevel())
                .isEqualTo(GeocodingSuggestionLevel.NEIGHBORHOOD);

        response.set(new Response(200, """
                [{"lat":"-23.56","lon":"-46.65","address":{"postcode":"99999-999",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """, 0));
        assertThat(client.geocodePostalCodeSuggestionOrThrow(address()).suggestedCoordinates()).isNull();

        response.set(new Response(200, """
                [{"lat":"-23.56","lon":"-46.65","address":{"postcode":"01310-200",
                "city":"São Paulo","state":"São Paulo","ISO3166-2-lvl4":"BR-SP","country_code":"br"}}]
                """, 0));
        assertThat(client.geocodePostalCodeSuggestionOrThrow(address()).suggestionLevel())
                .isEqualTo(GeocodingSuggestionLevel.POSTAL_CODE);
    }

    @Test
    void returnsFailedForRateLimitAndServerErrors() {
        response.set(new Response(429, "too many requests", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
        response.set(new Response(500, "server error", 0));
        assertThat(client.geocode(address()).status()).isEqualTo(GeocodingStatus.FAILED);
    }

    @Test
    void exposesPermanentProviderStatusForOperationalDiagnosis() {
        response.set(new Response(403, "access denied", 0));

        assertThatThrownBy(() -> client.geocodeOrThrow(address()))
                .isInstanceOf(GeocodingProviderException.class)
                .satisfies(exception -> {
                    GeocodingProviderException provider = (GeocodingProviderException) exception;
                    assertThat(provider.status()).isEqualTo(403);
                    assertThat(provider.isTransient()).isFalse();
                });
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
        requestQuery.set(exchange.getRequestURI().getRawQuery());
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
