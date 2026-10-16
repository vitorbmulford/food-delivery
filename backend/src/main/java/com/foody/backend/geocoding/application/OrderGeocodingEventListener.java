package com.foody.backend.geocoding.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
class OrderGeocodingEventListener {
    private final GeocodingDispatcher geocoding;

    OrderGeocodingEventListener(GeocodingDispatcher geocoding) { this.geocoding = geocoding; }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(OrderGeocodingRequestedEvent event) { geocoding.schedule(event.orderId()); }
}
