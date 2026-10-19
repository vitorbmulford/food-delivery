package com.foody.backend;

import com.foody.backend.auth.infrastructure.security.JwtProperties;
import com.foody.backend.geocoding.infrastructure.NominatimProperties;
import com.foody.backend.geocoding.application.GeocodingResilienceProperties;
import com.foody.backend.shared.ratelimit.RateLimitProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@EnableConfigurationProperties({JwtProperties.class, NominatimProperties.class, RateLimitProperties.class, GeocodingResilienceProperties.class})
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }

}
