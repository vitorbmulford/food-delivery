package com.foody.backend.orders.infrastructure.persistence;

import com.foody.backend.orders.domain.Order;
import com.foody.backend.orders.domain.OrderStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    @EntityGraph(attributePaths = {"customer", "items"})
    Optional<Order> findByIdAndCustomerId(UUID id, UUID customerId);

    @EntityGraph(attributePaths = {"customer", "items"})
    Page<Order> findByCustomerId(UUID customerId, Pageable pageable);

    @EntityGraph(attributePaths = {"customer", "items"})
    Page<Order> findByCustomerIdAndStatus(UUID customerId, OrderStatus status, Pageable pageable);
}
