package com.foody.backend.orders.api.dto;

public record DeliveryAddressResponse(String street, String number, String complement, String neighborhood,
                                      String city, String state, String postalCode) { }
