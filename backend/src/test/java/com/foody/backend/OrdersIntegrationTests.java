package com.foody.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.foody.backend.geocoding.domain.GeoCoordinates;
import com.foody.backend.geocoding.domain.GeocodingStatus;
import com.foody.backend.orders.infrastructure.persistence.OrderRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class OrdersIntegrationTests {
    private static final String ORDER = """
            {"items":[{"productName":"Hambúrguer Artesanal","quantity":2,"unitPrice":32.90},{"productName":"Refrigerante","quantity":1,"unitPrice":8.50}],
            "deliveryAddress":{"street":"Rua das Flores","number":"120","complement":"Apto 42","neighborhood":"Centro","city":"São Paulo","state":"SP","postalCode":"01001000"}}""";
    @Autowired private MockMvc mvc;
    @Autowired private OrderRepository orderRepository;

    @Test
    void createsListsGetsAndTransitionsOwnedOrder() throws Exception {
        String token = tokenFor("order-flow@example.com");
        MvcResult result = mvc.perform(post("/api/orders").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER))
                .andExpect(status().isCreated()).andExpect(header().string("Location", org.hamcrest.Matchers.containsString("/api/orders/")))
                .andExpect(jsonPath("$.status").value("RECEBIDO"))
                .andExpect(jsonPath("$.coordinates").doesNotExist())
                .andExpect(jsonPath("$.geocodingStatus").value("PENDING"))
                .andExpect(jsonPath("$.totalAmount").value(74.30))
                .andReturn();
        String id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");

        mvc.perform(get("/api/orders").header("Authorization", bearer(token)).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(id));
        mvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].subtotal").value(65.80));
        persistCoordinates(id);
        mvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.coordinates.latitude").value(-23.5614))
                .andExpect(jsonPath("$.coordinates.longitude").value(-46.6559))
                .andExpect(jsonPath("$.geocodingStatus").value("SUCCESS"));
        update(token, id, "EM_PREPARO").andExpect(status().isOk());
        update(token, id, "SAIU_PARA_ENTREGA").andExpect(status().isOk());
        update(token, id, "ENTREGUE").andExpect(status().isOk());
        update(token, id, "CANCELADO").andExpect(status().isConflict());
    }

    @Test
    void validatesAndProtectsOrders() throws Exception {
        String owner = tokenFor("owner-order@example.com");
        String stranger = tokenFor("stranger-order@example.com");
        mvc.perform(post("/api/orders").contentType(MediaType.APPLICATION_JSON).content(ORDER)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"items\":[],\"deliveryAddress\":{}}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(ORDER.replace("\"quantity\":2", "\"quantity\":0"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(ORDER.replace("\"unitPrice\":32.90", "\"unitPrice\":0"))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(ORDER.replace("\"street\":\"Rua das Flores\"", "\"street\":\"\""))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(ORDER.replace("Hambúrguer Artesanal", "X".repeat(161)))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(ORDER.replace("\"unitPrice\":32.90", "\"unitPrice\":99999999999999999.99")))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                .content(ORDER.replace("\"unitPrice\":32.90", "\"unitPrice\":60000000000000000.00")
                        .replace("\"unitPrice\":8.50", "\"unitPrice\":60000000000000000.00")))
                .andExpect(status().isBadRequest());
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON).content(ORDER))
                .andExpect(status().isCreated()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
        mvc.perform(get("/api/orders/{id}", id).header("Authorization", bearer(stranger))).andExpect(status().isNotFound());
        mvc.perform(post("/api/orders/{id}/geocode", id).header("Authorization", bearer(stranger))).andExpect(status().isNotFound());
        mvc.perform(post("/api/orders/{id}/geocode", id).header("Authorization", bearer(owner))).andExpect(status().isAccepted());
        mvc.perform(patch("/api/orders/{id}/location", id).header("Authorization", bearer(stranger))
                .contentType(MediaType.APPLICATION_JSON).content("{\"latitude\":-23.55,\"longitude\":-46.63}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/orders/{id}/location", id).header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON).content("{\"latitude\":91,\"longitude\":-46.63}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/orders/{id}/location", id).header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON).content("{\"latitude\":-23.550520,\"longitude\":-46.633309}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coordinates.latitude").value(-23.550520))
                .andExpect(jsonPath("$.coordinates.longitude").value(-46.633309))
                .andExpect(jsonPath("$.coordinateSource").value("MANUAL"))
                .andExpect(jsonPath("$.deliveryAddress.street").value("Rua das Flores"));
        mvc.perform(get("/api/orders/{id}", java.util.UUID.randomUUID()).header("Authorization", bearer(owner))).andExpect(status().isNotFound());
        update(owner, id, "ENTREGUE").andExpect(status().isConflict());
        mvc.perform(patch("/api/orders/{id}/status", id).header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"NOT_A_STATUS\"}")).andExpect(status().isBadRequest());
        update(owner, id, "CANCELADO").andExpect(status().isOk());
        update(owner, id, "EM_PREPARO").andExpect(status().isConflict());
        mvc.perform(patch("/api/orders/{id}/status", id).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"EM_PREPARO\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void persistsAndProtectsChronologicalStatusHistory() throws Exception {
        String owner = tokenFor("history-owner@example.com");
        String stranger = tokenFor("history-stranger@example.com");
        MvcResult created = mvc.perform(post("/api/orders").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(ORDER))
                .andExpect(status().isCreated()).andReturn();
        String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mvc.perform(get("/api/orders/{id}/history", id).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].previousStatus").doesNotExist())
                .andExpect(jsonPath("$[0].newStatus").value("RECEBIDO"))
                .andExpect(jsonPath("$[0].changedBy").isNotEmpty());

        update(owner, id, "ENTREGUE").andExpect(status().isConflict());
        mvc.perform(get("/api/orders/{id}/history", id).header("Authorization", bearer(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));

        update(owner, id, "EM_PREPARO").andExpect(status().isOk());
        update(owner, id, "SAIU_PARA_ENTREGA").andExpect(status().isOk());
        update(owner, id, "ENTREGUE").andExpect(status().isOk());
        mvc.perform(get("/api/orders/{id}/history", id).header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].newStatus").value("RECEBIDO"))
                .andExpect(jsonPath("$[1].previousStatus").value("RECEBIDO"))
                .andExpect(jsonPath("$[1].newStatus").value("EM_PREPARO"))
                .andExpect(jsonPath("$[2].newStatus").value("SAIU_PARA_ENTREGA"))
                .andExpect(jsonPath("$[3].newStatus").value("ENTREGUE"));

        mvc.perform(get("/api/orders/{id}/history", id).header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/orders/{id}/history", id)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/orders/{id}/history", UUID.randomUUID()).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    private org.springframework.test.web.servlet.ResultActions update(String token, String id, String state) throws Exception {
        return mvc.perform(patch("/api/orders/{id}/status", id).header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + state + "\"}"));
    }

    private String tokenFor(String email) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Order User\",\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isCreated());
        MvcResult login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"SenhaSegura123!\"}"))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
    }

    private String bearer(String token) { return "Bearer " + token; }

    private void persistCoordinates(String id) {
        var order = orderRepository.findById(UUID.fromString(id)).orElseThrow();
        order.applyGeocoding(GeocodingStatus.SUCCESS,
                new GeoCoordinates(new BigDecimal("-23.5614"), new BigDecimal("-46.6559")));
        orderRepository.save(order);
    }
}
