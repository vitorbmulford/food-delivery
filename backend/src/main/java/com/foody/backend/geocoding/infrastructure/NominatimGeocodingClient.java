package com.foody.backend.geocoding.infrastructure;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foody.backend.geocoding.domain.GeoCoordinates;
import com.foody.backend.geocoding.domain.GeocodingResult;
import com.foody.backend.orders.domain.DeliveryAddress;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Clock;
import java.time.format.DateTimeFormatter;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class NominatimGeocodingClient {
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public NominatimGeocodingClient(NominatimProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.connectTimeout());
        factory.setReadTimeout(properties.readTimeout());
        this.restClient = RestClient.builder().baseUrl(properties.baseUrl()).requestFactory(factory)
                .defaultHeader("User-Agent", properties.userAgent()).build();
        this.objectMapper = new ObjectMapper();
    }

    public GeocodingResult geocode(DeliveryAddress address) {
        try {
            return geocodeOrThrow(address);
        } catch (GeocodingProviderException ignored) {
            return GeocodingResult.failed();
        }
    }

    public GeocodingResult geocodeOrThrow(DeliveryAddress address) {
        try {
            String body = restClient.get().uri(uri(address)).retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        throw new NominatimHttpException(response.getStatusCode().value(),
                                parseRetryAfter(response.getHeaders().getFirst("Retry-After"), Clock.systemUTC()));
                    })
                    .body(String.class);
            return parse(body);
        } catch (NominatimHttpException exception) {
            throw providerException(exception.status(), exception.retryAfter());
        } catch (RestClientException exception) {
            throw new TransientGeocodingProviderException(0, null);
        }
    }

    private GeocodingProviderException providerException(int status, Duration retryAfter) {
        return status == 0 || status == 429 || status == 502 || status == 503 || status == 504
                ? new TransientGeocodingProviderException(status, retryAfter)
                : new GeocodingProviderException(status, retryAfter);
    }

    private URI uri(DeliveryAddress address) {
        String query = String.join(", ", address.getStreet() + ", " + address.getNumber(), address.getNeighborhood(),
                address.getCity() + " - " + address.getState(), address.getPostalCode(), "Brasil");
        return URI.create("/search?format=jsonv2&limit=1&q=" + URLEncoder.encode(query, StandardCharsets.UTF_8));
    }

    private GeocodingResult parse(String body) {
        try {
            List<Map<String, Object>> results = objectMapper.readValue(body, new TypeReference<>() { });
            if (results.isEmpty()) {
                return GeocodingResult.notFound();
            }
            Map<String, Object> result = results.getFirst();
            return GeocodingResult.success(new GeoCoordinates(new BigDecimal(String.valueOf(result.get("lat"))),
                    new BigDecimal(String.valueOf(result.get("lon")))));
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            throw new TransientGeocodingProviderException(0, null);
        }
    }

    static Duration parseRetryAfter(String value, Clock clock) {
        if (value == null || value.isBlank()) return null;
        try {
            long seconds = Long.parseLong(value);
            return seconds >= 0 ? Duration.ofSeconds(seconds) : null;
        } catch (NumberFormatException ignored) {
            try {
                Duration result = Duration.between(clock.instant(), ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant());
                return result.isNegative() ? Duration.ZERO : result;
            } catch (java.time.format.DateTimeParseException invalidDate) {
                return null;
            }
        }
    }

    private static final class NominatimHttpException extends RuntimeException {
        private final int status;
        private final java.time.Duration retryAfter;

        private NominatimHttpException(int status) { this(status, null); }
        private NominatimHttpException(int status, java.time.Duration retryAfter) { this.status = status; this.retryAfter = retryAfter; }
        private int status() { return status; }
        private java.time.Duration retryAfter() { return retryAfter; }
    }
}
