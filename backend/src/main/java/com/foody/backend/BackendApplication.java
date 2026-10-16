package com.foody.backend;

import com.foody.backend.auth.infrastructure.security.JwtProperties;
import com.foody.backend.geocoding.infrastructure.NominatimProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@EnableConfigurationProperties({JwtProperties.class, NominatimProperties.class})
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }

}
