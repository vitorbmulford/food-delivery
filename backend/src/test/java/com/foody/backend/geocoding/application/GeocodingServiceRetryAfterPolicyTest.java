package com.foody.backend.geocoding.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class GeocodingServiceRetryAfterPolicyTest {
    @Test
    void honorsRetryAfterUpToTheConfiguredWaitBudget() {
        assertThat(GeocodingService.permittedRetryAfter(Duration.ofSeconds(60)))
                .isEqualTo(GeocodingService.MAX_RETRY_AFTER_WAIT);
        assertThat(GeocodingService.permittedRetryAfter(Duration.ofSeconds(61))).isNull();
    }

    @Test
    void rejectsMissingNegativeAndHttpDateWaitsBeyondTheConfiguredBudget() {
        assertThat(GeocodingService.permittedRetryAfter(null)).isNull();
        assertThat(GeocodingService.permittedRetryAfter(Duration.ofSeconds(-1))).isNull();
        // HTTP-date parsing supplies a positive duration; the policy rejects it once it exceeds one minute.
        assertThat(GeocodingService.permittedRetryAfter(Duration.ofSeconds(120))).isNull();
    }
}
