package com.foody.backend.shared.observability;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class ProductionStructuredLoggingIntegrationTest {
    private static final String CORRELATED_MESSAGE = "production-json-correlation-check";
    private static final String CLEAN_MESSAGE = "production-json-mdc-cleanup-check";
    private static final String CORRELATION_ID = "prod-log-correlation-42";

    @Test
    void capturesAndParsesJsonFromProductionLogbackConfigurationWithoutMdcLeakage() throws Exception {
        String classPath = System.getProperty("surefire.test.class.path", System.getProperty("java.class.path"));
        Process process = new ProcessBuilder(javaExecutable(), "-cp", classPath,
                ProductionLogbackCaptureProcess.class.getName()).redirectErrorStream(true).start();
        boolean finished = process.waitFor(30, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new AssertionError("Isolated production Logback process did not finish within 30 seconds");
        }
        String console = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertThat(process.exitValue()).as("isolated log capture output: %s", console).isZero();

        ObjectMapper objectMapper = new ObjectMapper();
        List<JsonNode> events = console.lines()
                .filter(line -> line.contains(CORRELATED_MESSAGE) || line.contains(CLEAN_MESSAGE))
                .map(line -> readJson(objectMapper, line))
                .toList();
        assertThat(events).hasSize(2);

        JsonNode correlated = eventFor(events, CORRELATED_MESSAGE);
        JsonNode clean = eventFor(events, CLEAN_MESSAGE);
        assertStructuredFields(correlated, CORRELATED_MESSAGE);
        assertStructuredFields(clean, CLEAN_MESSAGE);
        assertThat(correlated.path("correlationId").asText()).isEqualTo(CORRELATION_ID);
        assertThat(clean.has("correlationId")).as("correlationId must be absent after MDC cleanup").isFalse();
    }

    private static String javaExecutable() {
        String executable = System.getProperty("os.name", "").toLowerCase().contains("win") ? "java.exe" : "java";
        return Path.of(System.getProperty("java.home"), "bin", executable).toString();
    }

    private static JsonNode readJson(ObjectMapper objectMapper, String line) {
        try {
            return objectMapper.readTree(line);
        } catch (Exception exception) {
            throw new AssertionError("Production console output was not valid JSON: " + line, exception);
        }
    }

    private static JsonNode eventFor(List<JsonNode> events, String message) {
        return events.stream().filter(event -> message.equals(event.path("message").asText())).findFirst()
                .orElseThrow(() -> new AssertionError("Missing structured log event: " + message));
    }

    private static void assertStructuredFields(JsonNode event, String expectedMessage) {
        assertThat(Instant.parse(event.path("@timestamp").asText())).isNotNull();
        assertThat(event.path("level").asText()).isEqualTo("INFO");
        assertThat(event.path("logger_name").asText()).isEqualTo("com.foody.backend.production.logging.validation");
        assertThat(event.path("message").asText()).isEqualTo(expectedMessage);
    }
}
