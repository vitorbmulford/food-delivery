package com.foody.backend.orders.infrastructure.persistence;

import com.foody.backend.orders.domain.Order;
import com.foody.backend.orders.domain.OrderStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    @EntityGraph(attributePaths = {"owner", "items"})
    Optional<Order> findByIdAndOwnerId(UUID id, UUID ownerId);

    @EntityGraph(attributePaths = {"owner", "items"})
    @Query(value = """
            select o from Order o where o.owner.id = :ownerId
              and (:status is null or o.status = :status)
              and (:hasSearch = false or lower(coalesce(o.customerName, '')) like concat('%', :search, '%')
                   or lower(coalesce(o.customerEmail, '')) like concat('%', :search, '%')
                   or (:hasPhoneDigits = true and coalesce(o.customerPhone, '') like concat('%', :phoneDigits, '%'))
                   or (:hasOrderId = true and o.id = :orderId))
            """,
            countQuery = """
            select count(o) from Order o where o.owner.id = :ownerId
              and (:status is null or o.status = :status)
              and (:hasSearch = false or lower(coalesce(o.customerName, '')) like concat('%', :search, '%')
                   or lower(coalesce(o.customerEmail, '')) like concat('%', :search, '%')
                   or (:hasPhoneDigits = true and coalesce(o.customerPhone, '') like concat('%', :phoneDigits, '%'))
                   or (:hasOrderId = true and o.id = :orderId))
            """)
    Page<Order> searchByOwner(@Param("ownerId") UUID ownerId, @Param("status") OrderStatus status,
                              @Param("search") String search, @Param("phoneDigits") String phoneDigits,
                              @Param("hasSearch") boolean hasSearch, @Param("hasPhoneDigits") boolean hasPhoneDigits,
                              @Param("hasOrderId") boolean hasOrderId, @Param("orderId") UUID orderId,
                              Pageable pageable);
}
