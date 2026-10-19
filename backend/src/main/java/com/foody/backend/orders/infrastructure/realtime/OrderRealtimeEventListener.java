package com.foody.backend.orders.infrastructure.realtime;

import com.foody.backend.orders.application.event.OrderStatusChangedEvent;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class OrderRealtimeEventListener {
    private final OrderRealtimePublisher publisher;

    public OrderRealtimeEventListener(OrderRealtimePublisher publisher) {
        this.publisher = publisher;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStatusChanged(OrderStatusChangedEvent event) {
        publisher.publish(event);
    }
}
