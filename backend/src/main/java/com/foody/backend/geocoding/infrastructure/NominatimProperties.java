package com.foody.backend.geocoding.infrastructure;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("geocoding.nominatim")
public record NominatimProperties(String baseUrl, String userAgent, Duration connectTimeout, Duration readTimeout) { }
