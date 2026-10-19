package com.foody.backend.geocoding.infrastructure;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.foody.backend.geocoding.domain.GeoCoordinates;
import com.foody.backend.geocoding.domain.GeocodingResult;
import com.foody.backend.geocoding.domain.GeocodingSuggestionLevel;
import com.foody.backend.orders.domain.DeliveryAddress;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Predicate;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class NominatimGeocodingClient {
    private static final Map<String, String> STATE_NAMES = Map.ofEntries(
            Map.entry("AC", "Acre"), Map.entry("AL", "Alagoas"), Map.entry("AP", "Amapá"),
            Map.entry("AM", "Amazonas"), Map.entry("BA", "Bahia"), Map.entry("CE", "Ceará"),
            Map.entry("DF", "Distrito Federal"), Map.entry("ES", "Espírito Santo"),
            Map.entry("GO", "Goiás"), Map.entry("MA", "Maranhão"), Map.entry("MT", "Mato Grosso"),
            Map.entry("MS", "Mato Grosso do Sul"), Map.entry("MG", "Minas Gerais"),
            Map.entry("PA", "Pará"), Map.entry("PB", "Paraíba"), Map.entry("PR", "Paraná"),
            Map.entry("PE", "Pernambuco"), Map.entry("PI", "Piauí"),
            Map.entry("RJ", "Rio de Janeiro"), Map.entry("RN", "Rio Grande do Norte"),
            Map.entry("RS", "Rio Grande do Sul"), Map.entry("RO", "Rondônia"),
            Map.entry("RR", "Roraima"), Map.entry("SC", "Santa Catarina"),
            Map.entry("SP", "São Paulo"), Map.entry("SE", "Sergipe"), Map.entry("TO", "Tocantins"));
    private static final List<String> CITY_KEYS = List.of("city", "town", "municipality", "village");
    private static final List<String> STREET_KEYS = List.of("road", "pedestrian", "residential", "path");
    private static final List<String> NEIGHBORHOOD_KEYS = List.of("neighbourhood", "suburb", "quarter", "city_district");

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
        String query = String.join(", ", address.getStreet() + ", " + address.getNumber(),
                address.getNeighborhood(), address.getCity() + " - " + address.getState(),
                address.getPostalCode(), "Brasil");
        return execute(freeFormUri(query, 1), this::parseExact);
    }

    public GeocodingResult geocodeStreetSuggestionOrThrow(DeliveryAddress address) {
        String query = String.join(", ", address.getStreet(),
                address.getCity() + " - " + address.getState(), "Brasil");
        return execute(freeFormUri(query, 5), results -> parseSuggestion(results, address,
                candidate -> matchesAny(candidate, STREET_KEYS, address.getStreet()),
                GeocodingSuggestionLevel.STREET));
    }

    public GeocodingResult geocodeNeighborhoodSuggestionOrThrow(DeliveryAddress address) {
        String query = String.join(", ", address.getNeighborhood(),
                address.getCity() + " - " + address.getState(), "Brasil");
        return execute(freeFormUri(query, 5), results -> parseSuggestion(results, address,
                candidate -> matchesAny(candidate, NEIGHBORHOOD_KEYS, address.getNeighborhood()),
                GeocodingSuggestionLevel.NEIGHBORHOOD));
    }

    public GeocodingResult geocodePostalCodeSuggestionOrThrow(DeliveryAddress address) {
        String query = "/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=br"
                + "&postalcode=" + encode(address.getPostalCode())
                + "&city=" + encode(address.getCity())
                + "&state=" + encode(address.getState())
                + "&country=" + encode("Brasil");
        return execute(URI.create(query), results -> parseSuggestion(results, address,
                candidate -> normalizedPostal(value(candidateAddress(candidate), "postcode"))
                        .equals(normalizedPostal(address.getPostalCode())),
                GeocodingSuggestionLevel.POSTAL_CODE));
    }

    private GeocodingResult execute(URI uri,
                                     java.util.function.Function<List<Map<String, Object>>, GeocodingResult> parser) {
        try {
            String body = restClient.get().uri(uri).retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> {
                        throw new NominatimHttpException(response.getStatusCode().value(),
                                parseRetryAfter(response.getHeaders().getFirst("Retry-After"), Clock.systemUTC()));
                    })
                    .body(String.class);
            List<Map<String, Object>> results = objectMapper.readValue(body, new TypeReference<>() { });
            return parser.apply(results);
        } catch (NominatimHttpException exception) {
            throw providerException(exception.status(), exception.retryAfter());
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            throw new TransientGeocodingProviderException(0, null, exception);
        } catch (RestClientException exception) {
            throw new TransientGeocodingProviderException(0, null, exception);
        }
    }

    private GeocodingResult parseExact(List<Map<String, Object>> results) {
        return results.isEmpty() ? GeocodingResult.notFound()
                : GeocodingResult.success(coordinates(results.getFirst()));
    }

    private GeocodingResult parseSuggestion(List<Map<String, Object>> results, DeliveryAddress expected,
                                             Predicate<Map<String, Object>> levelMatcher,
                                             GeocodingSuggestionLevel level) {
        return results.stream()
                .filter(candidate -> matchesRegion(candidate, expected))
                .filter(levelMatcher)
                .findFirst()
                .map(candidate -> GeocodingResult.approximate(coordinates(candidate), level))
                .orElseGet(GeocodingResult::notFound);
    }

    private boolean matchesRegion(Map<String, Object> candidate, DeliveryAddress expected) {
        Map<String, Object> address = candidateAddress(candidate);
        if (address.isEmpty()) return false;
        String expectedStateName = STATE_NAMES.get(expected.getState().toUpperCase(Locale.ROOT));
        boolean stateMatches = normalize(value(address, "ISO3166-2-lvl4"))
                .equals(normalize("BR-" + expected.getState()))
                || (expectedStateName != null && normalize(value(address, "state")).equals(normalize(expectedStateName)));
        return "br".equals(normalize(value(address, "country_code")))
                && stateMatches
                && matchesAny(address, CITY_KEYS, expected.getCity());
    }

    private boolean matchesAny(Map<String, Object> candidate, List<String> keys, String expected) {
        Map<String, Object> address = candidateAddress(candidate);
        String normalizedExpected = normalize(expected);
        return keys.stream().map(key -> normalize(value(address, key))).anyMatch(normalizedExpected::equals);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> candidateAddress(Map<String, Object> candidate) {
        Object rawAddress = candidate.get("address");
        return rawAddress instanceof Map<?, ?> ? (Map<String, Object>) rawAddress : candidate;
    }

    private GeoCoordinates coordinates(Map<String, Object> result) {
        return new GeoCoordinates(new BigDecimal(String.valueOf(result.get("lat"))),
                new BigDecimal(String.valueOf(result.get("lon"))));
    }

    private URI freeFormUri(String query, int limit) {
        return URI.create("/search?format=jsonv2&limit=" + limit
                + "&addressdetails=1&countrycodes=br&q=" + encode(query));
    }

    private String value(Map<String, Object> values, String key) {
        Object value = values.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private String normalizedPostal(String value) { return value.replaceAll("\\D", ""); }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", "");
    }

    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }

    private GeocodingProviderException providerException(int status, Duration retryAfter) {
        return status == 0 || status == 429 || status == 502 || status == 503 || status == 504
                ? new TransientGeocodingProviderException(status, retryAfter)
                : new GeocodingProviderException(status, retryAfter);
    }

    static Duration parseRetryAfter(String value, Clock clock) {
        if (value == null || value.isBlank()) return null;
        try {
            long seconds = Long.parseLong(value);
            return seconds >= 0 ? Duration.ofSeconds(seconds) : null;
        } catch (NumberFormatException ignored) {
            try {
                Duration result = Duration.between(clock.instant(),
                        ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant());
                return result.isNegative() ? Duration.ZERO : result;
            } catch (java.time.format.DateTimeParseException invalidDate) {
                return null;
            }
        }
    }

    private static final class NominatimHttpException extends RuntimeException {
        private final int status;
        private final Duration retryAfter;

        private NominatimHttpException(int status, Duration retryAfter) {
            this.status = status;
            this.retryAfter = retryAfter;
        }
        private int status() { return status; }
        private Duration retryAfter() { return retryAfter; }
    }
}
