package com.foody.backend.orders.domain;

import com.foody.backend.auth.domain.User;
import com.foody.backend.geocoding.domain.GeoCoordinates;
import com.foody.backend.geocoding.domain.GeocodingStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
public class Order {
    private static final int MONEY_SCALE = 2;

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;
    @Embedded
    private DeliveryAddress deliveryAddress;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();
    @Column(name = "total_amount", nullable = false, precision = 19, scale = MONEY_SCALE)
    private BigDecimal totalAmount;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Column(precision = 9, scale = 6)
    private BigDecimal latitude;
    @Column(precision = 9, scale = 6)
    private BigDecimal longitude;
    @Enumerated(EnumType.STRING)
    @Column(name = "geocoding_status", nullable = false, length = 20)
    private GeocodingStatus geocodingStatus;
    @Column(name = "geocoding_last_attempt_at")
    private Instant geocodingLastAttemptAt;
    @Version
    private Long version;

    protected Order() { }

    public static Order create(User customer, DeliveryAddress deliveryAddress, List<OrderItem> items, Instant now) {
        BigDecimal totalAmount = money(items.stream().map(OrderItem::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add));
        if (totalAmount.compareTo(OrderItem.MAX_PERSISTED_AMOUNT) > 0) {
            throw new OrderValueOutOfRangeException();
        }
        return new Order(customer, deliveryAddress, items, now, totalAmount);
    }

    private Order(User customer, DeliveryAddress deliveryAddress, List<OrderItem> items, Instant now, BigDecimal totalAmount) {
        this.id = UUID.randomUUID();
        this.customer = customer;
        this.status = OrderStatus.RECEBIDO;
        this.deliveryAddress = deliveryAddress;
        items.forEach(item -> {
            item.attachTo(this);
            this.items.add(item);
        });
        this.totalAmount = totalAmount;
        this.createdAt = now;
        this.updatedAt = now;
        this.geocodingStatus = GeocodingStatus.PENDING;
    }

    public void transitionTo(OrderStatus target, Instant now) {
        if (!status.canTransitionTo(target)) {
            throw new InvalidOrderStatusTransitionException(status, target);
        }
        status = target;
        updatedAt = now;
    }

    public boolean prepareGeocoding(Instant now) {
        if (latitude != null || longitude != null) {
            return false;
        }
        geocodingStatus = GeocodingStatus.PENDING;
        geocodingLastAttemptAt = now;
        return true;
    }

    public void applyGeocoding(GeocodingStatus result, GeoCoordinates coordinates) {
        geocodingStatus = result;
        if (result == GeocodingStatus.SUCCESS && coordinates != null) {
            latitude = coordinates.latitude();
            longitude = coordinates.longitude();
        }
    }

    private static BigDecimal money(BigDecimal amount) { return amount.setScale(MONEY_SCALE, RoundingMode.HALF_UP); }

    public UUID getId() { return id; }
    public User getCustomer() { return customer; }
    public OrderStatus getStatus() { return status; }
    public DeliveryAddress getDeliveryAddress() { return deliveryAddress; }
    public List<OrderItem> getItems() { return List.copyOf(items); }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public GeoCoordinates getCoordinates() { return latitude == null ? null : new GeoCoordinates(latitude, longitude); }
    public GeocodingStatus getGeocodingStatus() { return geocodingStatus; }
    public Instant getGeocodingLastAttemptAt() { return geocodingLastAttemptAt; }
}
