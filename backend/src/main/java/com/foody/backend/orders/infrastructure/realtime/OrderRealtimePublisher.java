package com.foody.backend.orders.infrastructure.realtime;

import com.foody.backend.orders.application.event.OrderStatusChangedEvent;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class OrderRealtimePublisher {
    private static final Logger log = LoggerFactory.getLogger(OrderRealtimePublisher.class);
    private final SimpMessagingTemplate messaging;

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "SimpMessagingTemplate is a Spring-managed shared collaborator intentionally injected into this singleton.")
    public OrderRealtimePublisher(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    public void publish(OrderStatusChangedEvent event) {
        try {
            messaging.convertAndSendToUser(event.ownerId().toString(), "/queue/orders",
                    new OrderStatusChangedMessage("ORDER_STATUS_CHANGED", event.orderId(), event.previousStatus(),
                            event.newStatus(), event.historyId(), event.changedAt()));
            log.info("Order status notification published operation=order.status.websocket orderId={} outcome=SUCCESS", event.orderId());
        } catch (RuntimeException exception) {
            // Delivery is best effort; the committed timeline remains the source of truth.
            log.warn("Could not publish status notification for order {}", event.orderId(), exception);
        }
    }
}
