package com.foody.backend.orders.api;

import com.foody.backend.orders.api.dto.CreateOrderRequest;
import com.foody.backend.orders.api.dto.OrderResponse;
import com.foody.backend.orders.api.dto.DashboardResponse;
import com.foody.backend.orders.api.dto.OrderStatusHistoryResponse;
import com.foody.backend.orders.api.dto.UpdateOrderStatusRequest;
import com.foody.backend.orders.api.dto.SetManualLocationRequest;
import com.foody.backend.orders.application.OrderService;
import com.foody.backend.orders.application.DashboardService;
import com.foody.backend.orders.domain.OrderStatus;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.time.LocalDate;
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
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Size;

@RestController
@Validated
@RequestMapping("/api/orders")
@Tag(name = "Orders", description = "Orders managed by the authenticated operator")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {
    private final OrderService orders;
    private final DashboardService dashboard;

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2",
            justification = "OrderService is a Spring-managed shared collaborator intentionally retained by this singleton.")
    public OrderController(OrderService orders, DashboardService dashboard) {
        this.orders = orders;
        this.dashboard = dashboard;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Get operational dashboard metrics", description = "Created orders are scoped by createdAt; delivered and cancelled counts are status history events in the requested Sao Paulo calendar period. Ongoing orders include all current open orders.")
    public DashboardResponse dashboard(@AuthenticationPrincipal Jwt jwt,
                                       @RequestParam LocalDate from,
                                       @RequestParam LocalDate to) {
        return dashboard.getDashboard(ownerId(jwt), from, to);
    }

    @PostMapping
    @Operation(summary = "Create an order", description = "Creates an order with initial status RECEBIDO. The total is calculated by the server.")
    @ApiResponse(responseCode = "201", description = "Order created")
    @ApiResponse(responseCode = "400", description = "Invalid item or delivery address")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    public ResponseEntity<OrderResponse> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateOrderRequest request) {
        OrderResponse order = orders.create(ownerId(jwt), request);
        return ResponseEntity.created(URI.create("/api/orders/" + order.id())).body(order);
    }

    @GetMapping
    @Operation(summary = "List the authenticated operator's orders", description = "Results are paged and sorted from newest to oldest. Search matches customer name, email, phone digits, or the exact UUID order ID. Maximum page size is 50.")
    @ApiResponse(responseCode = "200", description = "Paged orders")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    public Page<OrderResponse> list(@AuthenticationPrincipal Jwt jwt,
                                    @Parameter(description = "Zero-based page", in = ParameterIn.QUERY) @RequestParam(defaultValue = "0") int page,
                                    @Parameter(description = "Page size (1-50)", in = ParameterIn.QUERY) @RequestParam(defaultValue = "10") int size,
                                    @RequestParam(required = false) OrderStatus status,
                                    @Size(max = 100, message = "A busca deve ter no máximo 100 caracteres.")
                                    @RequestParam(required = false) String search) {
        return orders.list(ownerId(jwt), status, search, page, size);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an order", description = "Returns 404 for orders that do not exist or are owned by another customer.")
    @ApiResponse(responseCode = "200", description = "Order found")
    @ApiResponse(responseCode = "404", description = "Order not found")
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    public OrderResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return orders.get(ownerId(jwt), id);
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Get an order status history", description = "Returns the authenticated customer's status timeline in chronological order. `previousStatus` is null only for the initial RECEBIDO event, meaning that the order had no prior status.")
    @ApiResponse(responseCode = "200", description = "Chronologically ordered status history", content = @Content(examples = @ExampleObject(value = """
            [{"id":"1f73b52f-ec45-4c29-bf16-93ee0a84189e","previousStatus":null,"newStatus":"RECEBIDO","changedAt":"2026-10-16T19:30:00Z","changedBy":"7a5f6462-dd57-4fef-aed2-8825b85cef0b"},
             {"id":"8b8d2c70-1e24-4e95-9026-39f535fd7cd6","previousStatus":"RECEBIDO","newStatus":"EM_PREPARO","changedAt":"2026-10-16T19:40:00Z","changedBy":"7a5f6462-dd57-4fef-aed2-8825b85cef0b"}]
            """)))
    @ApiResponse(responseCode = "401", description = "Missing or invalid JWT")
    @ApiResponse(responseCode = "404", description = "Order not found")
    public List<OrderStatusHistoryResponse> history(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return orders.history(ownerId(jwt), id);
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
        return orders.updateStatus(ownerId(jwt), id, request.status());
    }

    @PostMapping("/{id}/geocode")
    @Operation(summary = "Request delivery-address geocoding", description = "Queues one asynchronous Nominatim lookup for the authenticated customer's order. Existing valid coordinates are preserved.")
    @ApiResponse(responseCode = "202", description = "Geocoding accepted or already in progress")
    @ApiResponse(responseCode = "404", description = "Order not found")
    public ResponseEntity<Void> geocode(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        orders.requestGeocoding(ownerId(jwt), id);
        return ResponseEntity.accepted().build();
    }

    @PatchMapping("/{id}/location")
    @Operation(summary = "Confirm a delivery point manually", description = "Stores user-confirmed coordinates without changing the original postal address. Later asynchronous geocoding results cannot replace a manual point.")
    @ApiResponse(responseCode = "200", description = "Manual location saved")
    @ApiResponse(responseCode = "400", description = "Invalid coordinates")
    @ApiResponse(responseCode = "404", description = "Order not found")
    public OrderResponse setManualLocation(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                           @Valid @RequestBody SetManualLocationRequest request) {
        return orders.setManualLocation(ownerId(jwt), id, request.latitude(), request.longitude());
    }

    private UUID ownerId(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
}
