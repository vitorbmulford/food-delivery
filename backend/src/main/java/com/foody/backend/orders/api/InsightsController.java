package com.foody.backend.orders.api;

import com.foody.backend.orders.api.dto.InsightsResponse;
import com.foody.backend.orders.application.InsightsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/insights")
@Tag(name = "Insights", description = "Commercial and operational analytics for the authenticated operator")
@SecurityRequirement(name = "bearerAuth")
public class InsightsController {
    private final InsightsService insights;

    public InsightsController(InsightsService insights) { this.insights = insights; }

    @GetMapping
    @Operation(summary = "Get commercial insights", description = "Date boundaries are inclusive Sao Paulo business dates. Creation metrics use created_at; delivered/cancelled metrics use the corresponding status event time. Previous period is the immediately preceding interval of equal length. Current status values are an all-time snapshot.")
    public InsightsResponse get(@AuthenticationPrincipal Jwt jwt, @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return insights.getInsights(UUID.fromString(jwt.getSubject()), from, to);
    }
}
