package com.foody.backend.orders.application;

import com.foody.backend.auth.domain.User;
import com.foody.backend.auth.infrastructure.persistence.UserRepository;
import com.foody.backend.orders.api.dto.CreateOrderItemRequest;
import com.foody.backend.orders.api.dto.CreateOrderRequest;
import com.foody.backend.orders.api.dto.DeliveryAddressResponse;
import com.foody.backend.orders.api.dto.GeoCoordinatesResponse;
import com.foody.backend.orders.api.dto.OrderCustomerResponse;
import com.foody.backend.orders.api.dto.OrderItemResponse;
import com.foody.backend.orders.api.dto.OrderResponse;
import com.foody.backend.orders.api.dto.OrderStatusHistoryResponse;
import com.foody.backend.orders.domain.DeliveryAddress;
import com.foody.backend.orders.domain.Order;
import com.foody.backend.orders.domain.OrderItem;
import com.foody.backend.orders.domain.OrderStatus;
import com.foody.backend.orders.domain.OrderStatusHistory;
import com.foody.backend.orders.infrastructure.persistence.OrderRepository;
import com.foody.backend.orders.infrastructure.persistence.OrderStatusHistoryRepository;
import com.foody.backend.geocoding.application.GeocodingDispatcher;
import com.foody.backend.geocoding.application.OrderGeocodingRequestedEvent;
import com.foody.backend.orders.application.event.OrderStatusChangedEvent;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

@Service
public class OrderService {
    private static final int DEFAULT_PAGE_SIZE = 10;
    private static final int MAX_PAGE_SIZE = 50;
    private final OrderRepository orders;
    private final OrderStatusHistoryRepository statusHistory;
    private final UserRepository users;
    private final ApplicationEventPublisher events;
    private final GeocodingDispatcher geocoding;
    private final Counter ordersCreated;
    private final Counter statusChanged;

    public OrderService(OrderRepository orders, OrderStatusHistoryRepository statusHistory, UserRepository users, ApplicationEventPublisher events, GeocodingDispatcher geocoding, MeterRegistry meterRegistry) {
        this.orders = orders;
        this.statusHistory = statusHistory;
        this.users = users;
        this.events = events;
        this.geocoding = geocoding;
        this.ordersCreated = Counter.builder("orders.created").register(meterRegistry);
        this.statusChanged = Counter.builder("orders.status.changed").register(meterRegistry);
    }

    @Transactional
    public OrderResponse create(UUID customerId, CreateOrderRequest request) {
        User customer = users.findById(customerId).orElseThrow(OrderNotFoundException::new);
        DeliveryAddress address = new DeliveryAddress(request.deliveryAddress().street(), request.deliveryAddress().number(),
                request.deliveryAddress().complement(), request.deliveryAddress().neighborhood(), request.deliveryAddress().city(),
                request.deliveryAddress().state().toUpperCase(java.util.Locale.ROOT), request.deliveryAddress().postalCode());
        List<OrderItem> items = request.items().stream()
                .map(item -> OrderItem.create(item.productName(), item.quantity(), item.unitPrice()))
                .toList();
        Instant now = Instant.now();
        Order order = orders.save(Order.create(customer, address, items, now));
        statusHistory.save(new OrderStatusHistory(order, null, OrderStatus.RECEBIDO, now, customer));
        events.publishEvent(new OrderGeocodingRequestedEvent(order.getId()));
        ordersCreated.increment();
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> list(UUID customerId, OrderStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Order> result = status == null ? orders.findByCustomerId(customerId, pageable)
                : orders.findByCustomerIdAndStatus(customerId, status, pageable);
        return result.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public OrderResponse get(UUID customerId, UUID id) {
        return toResponse(findOwned(id, customerId));
    }

    @Transactional
    public OrderResponse updateStatus(UUID customerId, UUID id, OrderStatus status) {
        Order order = findOwned(id, customerId);
        OrderStatus previousStatus = order.getStatus();
        Instant now = Instant.now();
        order.transitionTo(status, now);
        OrderStatusHistory history = statusHistory.save(new OrderStatusHistory(order, previousStatus, status, now, order.getCustomer()));
        events.publishEvent(new OrderStatusChangedEvent(order.getId(), order.getCustomer().getId(), previousStatus,
                status, history.getId(), history.getChangedAt()));
        statusChanged.increment();
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderStatusHistoryResponse> history(UUID customerId, UUID id) {
        findOwned(id, customerId);
        return statusHistory.findByOrderIdOrderByChangedAtAscIdAsc(id).stream()
                .map(this::toHistoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean requestGeocoding(UUID customerId, UUID id) {
        Order order = findOwned(id, customerId);
        if (order.getCoordinates() != null) {
            return false;
        }
        return geocoding.schedule(id);
    }

    private Order findOwned(UUID id, UUID customerId) {
        return orders.findByIdAndCustomerId(id, customerId).orElseThrow(OrderNotFoundException::new);
    }

    private OrderResponse toResponse(Order order) {
        DeliveryAddress address = order.getDeliveryAddress();
        return new OrderResponse(order.getId(), new OrderCustomerResponse(order.getCustomer().getId(), order.getCustomer().getName(), order.getCustomer().getEmail()),
                order.getStatus(), order.getItems().stream().map(item -> new OrderItemResponse(item.getId(), item.getProductName(), item.getQuantity(), item.getUnitPrice(), item.getSubtotal())).toList(),
                new DeliveryAddressResponse(address.getStreet(), address.getNumber(), address.getComplement(), address.getNeighborhood(), address.getCity(), address.getState(), address.getPostalCode()),
                order.getTotalAmount(), order.getCreatedAt(), order.getUpdatedAt(),
                order.getCoordinates() == null ? null : new GeoCoordinatesResponse(order.getCoordinates().latitude(), order.getCoordinates().longitude()),
                order.getGeocodingStatus());
    }

    private OrderStatusHistoryResponse toHistoryResponse(OrderStatusHistory event) {
        return new OrderStatusHistoryResponse(event.getId(), event.getPreviousStatus(), event.getNewStatus(),
                event.getChangedAt(), event.getChangedBy() == null ? null : event.getChangedBy().getId());
    }
}
