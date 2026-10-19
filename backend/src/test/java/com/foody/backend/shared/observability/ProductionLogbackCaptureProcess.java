package com.foody.backend.shared.observability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;

public final class ProductionLogbackCaptureProcess {
    private static final String CORRELATED_MESSAGE = "production-json-correlation-check";
    private static final String CLEAN_MESSAGE = "production-json-mdc-cleanup-check";
    private static final String CORRELATION_ID = "prod-log-correlation-42";

    private ProductionLogbackCaptureProcess() { }

    public static void main(String[] args) {
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(LoggingOnlyApplication.class)
                .profiles("prod").web(WebApplicationType.NONE)
                .properties("spring.main.banner-mode=off")
                .run()) {
            if (!context.getEnvironment().acceptsProfiles("prod")) {
                throw new IllegalStateException("The production profile was not activated");
            }
            Logger logger = LoggerFactory.getLogger("com.foody.backend.production.logging.validation");
            MDC.put(CorrelationIdFilter.MDC_KEY, CORRELATION_ID);
            logger.info(CORRELATED_MESSAGE);
            MDC.remove(CorrelationIdFilter.MDC_KEY);
            logger.info(CLEAN_MESSAGE);
        } finally {
            MDC.clear();
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class LoggingOnlyApplication { }
}
