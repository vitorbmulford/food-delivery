package com.foody.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class GeocodingEndToEndIntegrationTests {
    private static final AtomicInteger REQUESTS = new AtomicInteger();
    private static final HttpServer NOMINATIM = startNominatim();
    private static final String ORDER = """
            {"items":[{"productName":"Hambúrguer Artesanal","quantity":2,"unitPrice":32.90}],
            "deliveryAddress":{"street":"Avenida Paulista","number":"1578","neighborhood":"Bela Vista","city":"São Paulo","state":"SP","postalCode":"01310200"}}""";

    @Autowired private MockMvc mvc;

    @DynamicPropertySource
    static void nominatimProperties(DynamicPropertyRegistry registry) {
        registry.add("geocoding.nominatim.base-url", () -> "http://localhost:" + NOMINATIM.getAddress().getPort());
        registry.add("geocoding.nominatim.user-agent", () -> "foody-delivery-test/1.0 (contact: test@example.com)");
    }

    @AfterAll
    static void stopNominatim() { NOMINATIM.stop(0); }

    @Test
    void createsGeocodesPersistsAndReturnsCoordinatesWithoutDuplicateReprocessing() throws Exception {
        String token = tokenFor("geocoding-e2e@example.com");
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER))
                .andExpect(status().isCreated()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        String response = awaitSuccess(token, id);
        assertThat(JsonPath.read(response, "$.coordinates.latitude").toString()).isEqualTo("-23.5614");
        assertThat(JsonPath.read(response, "$.coordinates.longitude").toString()).isEqualTo("-46.6559");
        assertThat(REQUESTS.get()).isEqualTo(1);

        mvc.perform(post("/api/orders/{id}/geocode", id).header("Authorization", bearer(token)))
                .andExpect(status().isAccepted());
        Thread.sleep(250);
        assertThat(REQUESTS.get()).isEqualTo(1);
    }

    private String awaitSuccess(String token, String id) throws Exception {
        for (int attempt = 0; attempt < 30; attempt++) {
            MvcResult result = mvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(token)))
                    .andExpect(status().isOk()).andReturn();
            String body = result.getResponse().getContentAsString();
            if ("SUCCESS".equals(JsonPath.read(body, "$.geocodingStatus"))) {
                return body;
            }
            Thread.sleep(100);
        }
        throw new AssertionError("Geocoding did not finish successfully");
    }

    private String tokenFor(String email) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Geocoding User\",\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isCreated());
        MvcResult login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
    }

    private static HttpServer startNominatim() {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
            server.createContext("/search", exchange -> {
                REQUESTS.incrementAndGet();
                byte[] body = "[{\"lat\":\"-23.5614\",\"lon\":\"-46.6559\"}]".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
                exchange.close();
            });
            server.start();
            return server;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to start local Nominatim server", exception);
        }
    }

    private String bearer(String token) { return "Bearer " + token; }
}
