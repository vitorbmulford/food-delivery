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
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class NominatimGeocodingClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(NominatimGeocodingClient.class);
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
            String body = restClient.get().uri(uri(address)).retrieve()
                    .onStatus(HttpStatusCode::isError, (request, response) -> { throw new NominatimHttpException(response.getStatusCode().value()); })
                    .body(String.class);
            return parse(body);
        } catch (NominatimHttpException exception) {
            LOGGER.warn("Nominatim request failed with HTTP status {}", exception.status());
            return GeocodingResult.failed();
        } catch (RestClientException exception) {
            LOGGER.warn("Nominatim request was unavailable: {}", exception.getClass().getSimpleName());
            return GeocodingResult.failed();
        }
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
            LOGGER.warn("Nominatim returned an invalid geocoding response");
            return GeocodingResult.failed();
        }
    }

    private static final class NominatimHttpException extends RuntimeException {
        private final int status;

        private NominatimHttpException(int status) { this.status = status; }
        private int status() { return status; }
    }
}
