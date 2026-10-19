package com.foody.backend.orders.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateOrderCustomerRequest(
        @NotBlank(message = "Informe o nome do cliente.")
        @Size(max = 120, message = "O nome do cliente deve ter no máximo 120 caracteres.")
        String name,
        @NotBlank(message = "Informe o telefone do cliente.")
        @Pattern(regexp = "\\d{10,11}", message = "Informe um telefone brasileiro válido com DDD.")
        String phone,
        @Email(message = "Informe um e-mail válido.")
        @Size(max = 320, message = "O e-mail do cliente deve ter no máximo 320 caracteres.")
        String email) {
    public CreateOrderCustomerRequest {
        name = name == null ? null : name.trim();
        phone = phone == null ? null : phone.replaceAll("\\D", "");
        email = email == null || email.trim().isEmpty() ? null : email.trim();
    }
}
