package com.foody.backend.orders.api;

import com.foody.backend.orders.api.dto.CreateOrderRequest;
import com.foody.backend.orders.api.dto.OrderResponse;
import com.foody.backend.orders.api.dto.UpdateOrderStatusRequest;
import com.foody.backend.orders.application.OrderService;
import com.foody.backend.orders.domain.OrderStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Orders belonging to the authenticated customer")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {
    private final OrderService orders;

    public OrderController(OrderService orders) { this.orders = orders; }

    @PostMapping
    @Operation(summary = "Create an order", description = "Creates an order with initial status RECEBIDO. The total is calculated by the server.")
    @ApiResponse(responseCode = "201", description = "Order created")
    @ApiResponse(responseCode = "400", description = "Invalid item or delivery address")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    public ResponseEntity<OrderResponse> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateOrderRequest request) {
        OrderResponse order = orders.create(customerId(jwt), request);
        return ResponseEntity.created(URI.create("/api/orders/" + order.id())).body(order);
    }

    @GetMapping
    @Operation(summary = "List authenticated customer's orders", description = "Results are paged and sorted from newest to oldest. Maximum page size is 50.")
    @ApiResponse(responseCode = "200", description = "Paged orders")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    public Page<OrderResponse> list(@AuthenticationPrincipal Jwt jwt,
                                    @Parameter(description = "Zero-based page", in = ParameterIn.QUERY) @RequestParam(defaultValue = "0") int page,
                                    @Parameter(description = "Page size (1-50)", in = ParameterIn.QUERY) @RequestParam(defaultValue = "10") int size,
                                    @RequestParam(required = false) OrderStatus status) {
        return orders.list(customerId(jwt), status, page, size);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an order", description = "Returns 404 for orders that do not exist or are owned by another customer.")
    @ApiResponse(responseCode = "200", description = "Order found")
    @ApiResponse(responseCode = "404", description = "Order not found")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    public OrderResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return orders.get(customerId(jwt), id);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update an order status", description = "Allowed transitions: RECEBIDO → EM_PREPARO or CANCELADO; EM_PREPARO → SAIU_PARA_ENTREGA or CANCELADO; SAIU_PARA_ENTREGA → ENTREGUE. ENTREGUE and CANCELADO are terminal. In this MVP the owner can perform the transition; production should restrict it to authorized operators.")
    @ApiResponse(responseCode = "200", description = "Status updated")
    @ApiResponse(responseCode = "400", description = "Invalid or unknown status")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    @ApiResponse(responseCode = "404", description = "Order not found")
    @ApiResponse(responseCode = "409", description = "Invalid transition or concurrent update")
    public OrderResponse updateStatus(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                      @Valid @RequestBody UpdateOrderStatusRequest request) {
        return orders.updateStatus(customerId(jwt), id, request.status());
    }

    @PostMapping("/{id}/geocode")
    @Operation(summary = "Request delivery-address geocoding", description = "Queues one asynchronous Nominatim lookup for the authenticated customer's order. Existing valid coordinates are preserved.")
    @ApiResponse(responseCode = "202", description = "Geocoding accepted or already in progress")
    @ApiResponse(responseCode = "404", description = "Order not found")
    public ResponseEntity<Void> geocode(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        orders.requestGeocoding(customerId(jwt), id);
        return ResponseEntity.accepted().build();
    }

    private UUID customerId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
