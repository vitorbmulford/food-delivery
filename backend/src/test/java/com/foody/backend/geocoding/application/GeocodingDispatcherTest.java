package com.foody.backend.geocoding.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskRejectedException;

class GeocodingDispatcherTest {
    @Test
    void releasesInFlightOrderWhenExecutorRejectsTaskSoItCanBeRetried() {
        GeocodingInFlightRegistry registry = new GeocodingInFlightRegistry();
        GeocodingService geocoding = mock(GeocodingService.class);
        GeocodingDispatcher dispatcher = new GeocodingDispatcher(registry, geocoding);
        UUID orderId = UUID.randomUUID();
        doThrow(new TaskRejectedException("executor queue is full")).when(geocoding).geocodeAsync(orderId);

        assertThat(dispatcher.schedule(orderId)).isFalse();

        doNothing().when(geocoding).geocodeAsync(orderId);
        assertThat(dispatcher.schedule(orderId)).isTrue();
        assertThat(dispatcher.schedule(orderId)).isFalse();
    }
}
