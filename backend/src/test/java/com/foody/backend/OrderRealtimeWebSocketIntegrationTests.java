package com.foody.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jayway.jsonpath.JsonPath;
import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import com.foody.backend.orders.application.OrderService;
import com.foody.backend.orders.domain.OrderStatus;
import com.foody.backend.orders.infrastructure.persistence.OrderRepository;
import com.foody.backend.orders.infrastructure.persistence.OrderStatusHistoryRepository;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

@Import({TestcontainersConfiguration.class, OrderRealtimeWebSocketIntegrationTests.ConcurrencyTestConfiguration.class})
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrderRealtimeWebSocketIntegrationTests {
    private static final String ORDER = """
            {"items":[{"productName":"Pizza","quantity":1,"unitPrice":42.00}],
            "deliveryAddress":{"street":"Rua das Flores","number":"120","neighborhood":"Centro","city":"São Paulo","state":"SP","postalCode":"01001000"}}""";

    @LocalServerPort private int port;
    @Autowired private SimpUserRegistry users;
    @Autowired private TransactionTemplate transactions;
    @Autowired private OrderService orderService;
    @Autowired private OrderRepository orders;
    @Autowired private OrderStatusHistoryRepository history;
    @Autowired private ConcurrentOrderReadGate readGate;

    @Test
    void deliversCommittedStatusChangeOnlyToTheOrderOwner() throws Exception {
        String ownerToken = registerAndLogin("realtime-owner@example.com");
        String otherToken = registerAndLogin("realtime-other@example.com");
        String orderId = JsonPath.read(request("POST", "/api/orders", ownerToken, ORDER).body(), "$.id");
        CountDownLatch ownerReceived = new CountDownLatch(1);
        CountDownLatch otherReceived = new CountDownLatch(1);
        AtomicReference<Map<String, Object>> ownerEvent = new AtomicReference<>();
        WebSocketStompClient stomp = new WebSocketStompClient(new StandardWebSocketClient());
        stomp.setTaskScheduler(new ConcurrentTaskScheduler());
        StompSession owner = connect(stomp, ownerToken);
        StompSession other = connect(stomp, otherToken);
        try {
            subscribe(owner, ownerReceived, ownerEvent);
            subscribe(other, otherReceived, new AtomicReference<>());
            awaitSubscription();

            HttpResponse<String> update = request("PATCH", "/api/orders/" + orderId + "/status", ownerToken,
                    "{\"status\":\"EM_PREPARO\"}");

            assertThat(update.statusCode()).isEqualTo(200);
            assertThat(ownerReceived.await(5, TimeUnit.SECONDS))
                    .as("connected STOMP users: %s", users.getUsers().stream().map(user -> user.getName() + ":" + user.getSessions().size()).toList())
                    .isTrue();
            assertThat(otherReceived.await(300, TimeUnit.MILLISECONDS)).isFalse();
            assertThat(ownerEvent.get()).containsEntry("eventType", "ORDER_STATUS_CHANGED")
                    .containsEntry("orderId", orderId).containsEntry("previousStatus", "RECEBIDO")
                    .containsEntry("newStatus", "EM_PREPARO");
            assertThat(ownerEvent.get().get("historyId")).isNotNull();
            assertThat(ownerEvent.get().get("changedAt")).isNotNull();
        } finally {
            if (owner.isConnected()) owner.disconnect();
            if (other.isConnected()) other.disconnect();
            stomp.stop();
        }
    }

    @Test
    void publishesAfterCommitButNotAfterRollback() throws Exception {
        String token = registerAndLogin("realtime-rollback@example.com");
        String createdOrder = request("POST", "/api/orders", token, ORDER).body();
        String orderId = JsonPath.read(createdOrder, "$.id");
        UUID ownerId = UUID.fromString(JsonPath.read(createdOrder, "$.customer.id"));
        UUID id = UUID.fromString(orderId);
        LinkedBlockingQueue<Map<String, Object>> events = new LinkedBlockingQueue<>();
        WebSocketStompClient stomp = new WebSocketStompClient(new StandardWebSocketClient());
        stomp.setTaskScheduler(new ConcurrentTaskScheduler());
        StompSession session = connect(stomp, token);
        try {
            subscribe(session, new CountDownLatch(1), new AtomicReference<>(), events);
            awaitSubscription();

            transactions.executeWithoutResult(status -> orderService.updateStatus(ownerId, id, OrderStatus.EM_PREPARO));
            Map<String, Object> committed = events.poll(5, TimeUnit.SECONDS);
            assertThat(committed).isNotNull().containsEntry("newStatus", "EM_PREPARO");
            assertThat(history.findByOrderIdOrderByChangedAtAscIdAsc(id)).hasSize(2);

            transactions.executeWithoutResult(status -> {
                orderService.updateStatus(ownerId, id, OrderStatus.SAIU_PARA_ENTREGA);
                status.setRollbackOnly();
            });

            assertThat(orders.findById(id).orElseThrow().getStatus()).isEqualTo(OrderStatus.EM_PREPARO);
            assertThat(history.findByOrderIdOrderByChangedAtAscIdAsc(id)).hasSize(2);
            assertThat(events.poll(500, TimeUnit.MILLISECONDS)).isNull();
        } finally {
            if (session.isConnected()) session.disconnect();
            stomp.stop();
        }
    }

    @Test
    void publishesOnlyWinningTransitionWhenOptimisticLockingRejectsStaleTransaction() throws Exception {
        String token = registerAndLogin("realtime-concurrent@example.com");
        String createdOrder = request("POST", "/api/orders", token, ORDER).body();
        UUID id = UUID.fromString(JsonPath.read(createdOrder, "$.id"));
        UUID ownerId = UUID.fromString(JsonPath.read(createdOrder, "$.customer.id"));
        LinkedBlockingQueue<Map<String, Object>> events = new LinkedBlockingQueue<>();
        WebSocketStompClient stomp = new WebSocketStompClient(new StandardWebSocketClient());
        stomp.setTaskScheduler(new ConcurrentTaskScheduler());
        StompSession session = connect(stomp, token);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            subscribe(session, new CountDownLatch(1), new AtomicReference<>(), events);
            awaitSubscription();
            readGate.arm();
            Future<?> winner = executor.submit(() -> transactions.executeWithoutResult(status ->
                    orderService.updateStatus(ownerId, id, OrderStatus.EM_PREPARO)));
            Future<?> loser = executor.submit(() -> transactions.executeWithoutResult(status ->
                    orderService.updateStatus(ownerId, id, OrderStatus.CANCELADO)));
            assertThat(readGate.bothLoaded.await(5, TimeUnit.SECONDS)).isTrue();
            readGate.releaseWinner.countDown();
            winner.get(5, TimeUnit.SECONDS);
            readGate.releaseLoser.countDown();
            assertThatThrownBy(() -> loser.get(5, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);

            Map<String, Object> event = events.poll(5, TimeUnit.SECONDS);
            assertThat(event).isNotNull().containsEntry("orderId", id.toString())
                    .containsEntry("previousStatus", "RECEBIDO").containsEntry("newStatus", "EM_PREPARO");
            assertThat(events.poll(500, TimeUnit.MILLISECONDS)).isNull();
            assertThat(orders.findById(id).orElseThrow().getStatus()).isEqualTo(OrderStatus.EM_PREPARO);
            assertThat(history.findByOrderIdOrderByChangedAtAscIdAsc(id)).hasSize(2);
        } finally {
            executor.shutdownNow();
            if (session.isConnected()) session.disconnect();
            stomp.stop();
        }
    }

    private StompSession connect(WebSocketStompClient stomp, String token) throws Exception {
        StompHeaders headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token);
        return stomp.connectAsync(URI.create("ws://localhost:" + port + "/ws"), new WebSocketHttpHeaders(), headers,
                new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);
    }

    private void subscribe(StompSession session, CountDownLatch received, AtomicReference<Map<String, Object>> event) throws Exception {
        subscribe(session, received, event, null);
    }

    private void subscribe(StompSession session, CountDownLatch received, AtomicReference<Map<String, Object>> event,
                           LinkedBlockingQueue<Map<String, Object>> events) throws Exception {
        session.setAutoReceipt(true);
        session.subscribe("/user/queue/orders", new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders headers) { return byte[].class; }
            @Override public void handleFrame(StompHeaders headers, Object payload) {
                Map<String, Object> receivedEvent = JsonPath.parse(new String((byte[]) payload, StandardCharsets.UTF_8)).read("$");
                event.set(receivedEvent);
                if (events != null) events.offer(receivedEvent);
                received.countDown();
            }
        });
    }

    private void awaitSubscription() throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            if (users.getUsers().stream().anyMatch(user -> user.getSessions().stream()
                    .flatMap(session -> session.getSubscriptions().stream())
                    .anyMatch(subscription -> "/user/queue/orders".equals(subscription.getDestination())))) {
                return;
            }
            TimeUnit.MILLISECONDS.sleep(10);
        }
        throw new AssertionError("STOMP subscription was not registered");
    }

    private String registerAndLogin(String email) throws Exception {
        assertThat(request("POST", "/api/auth/register", null,
                "{\"name\":\"Realtime User\",\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}").statusCode()).isEqualTo(201);
        return JsonPath.read(request("POST", "/api/auth/login", null,
                "{\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}").body(), "$.accessToken");
    }

    private HttpResponse<String> request(String method, String path, String token, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(Duration.ofSeconds(5)).header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        return HttpClient.newHttpClient().send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    @TestConfiguration
    @EnableAspectJAutoProxy
    @Import(ConcurrentOrderReadGate.class)
    static class ConcurrencyTestConfiguration {
    }

    @Aspect
    static class ConcurrentOrderReadGate {
        private CountDownLatch bothLoaded = new CountDownLatch(0);
        private CountDownLatch releaseWinner = new CountDownLatch(0);
        private CountDownLatch releaseLoser = new CountDownLatch(0);

        void arm() {
            bothLoaded = new CountDownLatch(2);
            releaseWinner = new CountDownLatch(1);
            releaseLoser = new CountDownLatch(1);
        }

        @Around("execution(* com.foody.backend.orders.infrastructure.persistence.OrderRepository.findByIdAndCustomerId(..))")
        public Object pauseAfterRead(ProceedingJoinPoint joinPoint) throws Throwable {
            Object result = joinPoint.proceed();
            if (bothLoaded.getCount() == 0) return result;
            bothLoaded.countDown();
            if (Thread.currentThread().getName().contains("1")) releaseWinner.await(5, TimeUnit.SECONDS);
            else releaseLoser.await(5, TimeUnit.SECONDS);
            return result;
        }
    }
}
