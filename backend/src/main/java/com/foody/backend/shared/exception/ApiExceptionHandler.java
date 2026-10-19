package com.foody.backend.shared.exception;

import com.foody.backend.auth.application.EmailAlreadyRegisteredException;
import com.foody.backend.orders.application.OrderNotFoundException;
import com.foody.backend.orders.application.InvalidDashboardPeriodException;
import com.foody.backend.orders.domain.InvalidOrderStatusTransitionException;
import com.foody.backend.orders.domain.OrderValueOutOfRangeException;
import java.time.Instant;
import java.util.Map;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalidRequest(MethodArgumentNotValidException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed");
        problem.setProperty("errors", exception.getBindingResult().getFieldErrors().stream()
                .collect(java.util.stream.Collectors.toMap(error -> error.getField(), error -> error.getDefaultMessage(), (first, ignored) -> first)));
        return problem;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail invalidConstraint(ConstraintViolationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request validation failed");
        problem.setProperty("errors", exception.getConstraintViolations().stream()
                .collect(java.util.stream.Collectors.toMap(
                        violation -> violation.getPropertyPath().toString(),
                        violation -> violation.getMessage(), (first, ignored) -> first)));
        return problem;
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    ProblemDetail duplicateEmail() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "Email is already registered");
    }

    @ExceptionHandler({BadCredentialsException.class, AuthenticationCredentialsNotFoundException.class})
    ProblemDetail invalidCredentials() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    @ExceptionHandler(OrderNotFoundException.class)
    ProblemDetail orderNotFound() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Order not found");
    }

    @ExceptionHandler(OrderValueOutOfRangeException.class)
    ProblemDetail orderValueOutOfRange() {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Order amount exceeds the maximum supported value");
    }

    @ExceptionHandler(InvalidDashboardPeriodException.class)
    ProblemDetail invalidDashboardPeriod(InvalidDashboardPeriodException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler({InvalidOrderStatusTransitionException.class, ObjectOptimisticLockingFailureException.class})
    ProblemDetail conflictingOrderUpdate(RuntimeException exception) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
    }
}
