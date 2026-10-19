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
import com.foody.backend.geocoding.domain.GeoCoordinates;
import com.foody.backend.orders.application.event.OrderStatusChangedEvent;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
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
    public OrderResponse create(UUID ownerId, CreateOrderRequest request) {
        User owner = users.findById(ownerId).orElseThrow(OrderNotFoundException::new);
        DeliveryAddress address = new DeliveryAddress(request.deliveryAddress().street(), request.deliveryAddress().number(),
                request.deliveryAddress().complement(), request.deliveryAddress().neighborhood(), request.deliveryAddress().city(),
                request.deliveryAddress().state().toUpperCase(java.util.Locale.ROOT), request.deliveryAddress().postalCode());
        List<OrderItem> items = request.items().stream()
                .map(item -> OrderItem.create(item.productName(), item.quantity(), item.unitPrice()))
                .toList();
        Instant now = Instant.now();
        Order order = orders.save(Order.create(owner, request.customer().name(), request.customer().phone(),
                request.customer().email(), address, items, now));
        statusHistory.save(new OrderStatusHistory(order, null, OrderStatus.RECEBIDO, now, owner));
        events.publishEvent(new OrderGeocodingRequestedEvent(order.getId()));
        ordersCreated.increment();
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public Page<OrderResponse> list(UUID ownerId, OrderStatus status, String search, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        String normalizedSearch = normalizeSearch(search);
        String phoneDigits = normalizedSearch.replaceAll("\\D", "");
        UUID orderId = parseUuid(normalizedSearch);
        Page<Order> result = orders.searchByOwner(ownerId, status, normalizedSearch, phoneDigits,
                !normalizedSearch.isEmpty(), !phoneDigits.isEmpty(), orderId != null, orderId, pageable);
        return result.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public OrderResponse get(UUID ownerId, UUID id) {
        return toResponse(findOwned(id, ownerId));
    }

    @Transactional
    public OrderResponse updateStatus(UUID ownerId, UUID id, OrderStatus status) {
        Order order = findOwned(id, ownerId);
        OrderStatus previousStatus = order.getStatus();
        Instant now = Instant.now();
        order.transitionTo(status, now);
        OrderStatusHistory history = statusHistory.save(new OrderStatusHistory(order, previousStatus, status, now, order.getOwner()));
        events.publishEvent(new OrderStatusChangedEvent(order.getId(), order.getOwner().getId(), previousStatus,
                status, history.getId(), history.getChangedAt()));
        statusChanged.increment();
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderStatusHistoryResponse> history(UUID ownerId, UUID id) {
        findOwned(id, ownerId);
        return statusHistory.findByOrderIdOrderByChangedAtAscIdAsc(id).stream()
                .map(this::toHistoryResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean requestGeocoding(UUID ownerId, UUID id) {
        Order order = findOwned(id, ownerId);
        if (order.getCoordinates() != null) {
            return false;
        }
        return geocoding.schedule(id);
    }

    @Transactional
    public OrderResponse setManualLocation(UUID ownerId, UUID id, BigDecimal latitude, BigDecimal longitude) {
        Order order = findOwned(id, ownerId);
        order.confirmManualCoordinates(new GeoCoordinates(latitude, longitude), Instant.now());
        return toResponse(order);
    }

    private Order findOwned(UUID id, UUID ownerId) {
        return orders.findByIdAndOwnerId(id, ownerId).orElseThrow(OrderNotFoundException::new);
    }

    private OrderResponse toResponse(Order order) {
        DeliveryAddress address = order.getDeliveryAddress();
        return new OrderResponse(order.getId(), new OrderCustomerResponse(order.getCustomerName(), order.getCustomerPhone(), order.getCustomerEmail()),
                order.getStatus(), order.getItems().stream().map(item -> new OrderItemResponse(item.getId(), item.getProductName(), item.getQuantity(), item.getUnitPrice(), item.getSubtotal())).toList(),
                new DeliveryAddressResponse(address.getStreet(), address.getNumber(), address.getComplement(), address.getNeighborhood(), address.getCity(), address.getState(), address.getPostalCode()),
                order.getTotalAmount(), order.getCreatedAt(), order.getUpdatedAt(),
                order.getCoordinates() == null ? null : new GeoCoordinatesResponse(order.getCoordinates().latitude(), order.getCoordinates().longitude()),
                order.getGeocodingStatus(), order.getCoordinateSource(),
                order.getSuggestedCoordinates() == null ? null
                        : new GeoCoordinatesResponse(order.getSuggestedCoordinates().latitude(), order.getSuggestedCoordinates().longitude()),
                order.getGeocodingSuggestionLevel());
    }

    private OrderStatusHistoryResponse toHistoryResponse(OrderStatusHistory event) {
        return new OrderStatusHistoryResponse(event.getId(), event.getPreviousStatus(), event.getNewStatus(),
                event.getChangedAt(), event.getChangedBy() == null ? null : event.getChangedBy().getId());
    }

    private String normalizeSearch(String search) {
        if (search == null || search.trim().isEmpty()) return "";
        return search.trim().toLowerCase(Locale.ROOT);
    }

    private UUID parseUuid(String search) {
        if (search == null) return null;
        try {
            return UUID.fromString(search);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
