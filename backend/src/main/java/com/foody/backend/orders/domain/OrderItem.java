package com.foody.backend.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Entity
@Table(name = "order_items")
public class OrderItem {
    private static final int MONEY_SCALE = 2;

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;
    @Column(name = "product_name", nullable = false, length = 160)
    private String productName;
    @Column(nullable = false)
    private Integer quantity;
    @Column(name = "unit_price", nullable = false, precision = 19, scale = MONEY_SCALE)
    private BigDecimal unitPrice;
    @Column(nullable = false, precision = 19, scale = MONEY_SCALE)
    private BigDecimal subtotal;

    protected OrderItem() { }

    public OrderItem(String productName, Integer quantity, BigDecimal unitPrice) {
        this.id = UUID.randomUUID();
        this.productName = productName;
        this.quantity = quantity;
        this.unitPrice = money(unitPrice);
        this.subtotal = money(this.unitPrice.multiply(BigDecimal.valueOf(quantity)));
    }

    void attachTo(Order order) { this.order = order; }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    public UUID getId() { return id; }
    public String getProductName() { return productName; }
    public Integer getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public BigDecimal getSubtotal() { return subtotal; }
}
