package com.foody.backend.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class DeliveryAddress {
    @Column(name = "delivery_street", nullable = false, length = 160)
    private String street;
    @Column(name = "delivery_number", nullable = false, length = 30)
    private String number;
    @Column(name = "delivery_complement", length = 120)
    private String complement;
    @Column(name = "delivery_neighborhood", nullable = false, length = 120)
    private String neighborhood;
    @Column(name = "delivery_city", nullable = false, length = 120)
    private String city;
    @Column(name = "delivery_state", nullable = false, length = 2)
    private String state;
    @Column(name = "delivery_postal_code", nullable = false, length = 16)
    private String postalCode;

    protected DeliveryAddress() { }

    public DeliveryAddress(String street, String number, String complement, String neighborhood, String city, String state, String postalCode) {
        this.street = street;
        this.number = number;
        this.complement = complement;
        this.neighborhood = neighborhood;
        this.city = city;
        this.state = state;
        this.postalCode = postalCode;
    }

    public String getStreet() { return street; }
    public String getNumber() { return number; }
    public String getComplement() { return complement; }
    public String getNeighborhood() { return neighborhood; }
    public String getCity() { return city; }
    public String getState() { return state; }
    public String getPostalCode() { return postalCode; }
}
