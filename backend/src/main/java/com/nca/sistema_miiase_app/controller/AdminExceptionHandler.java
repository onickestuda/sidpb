package com.nca.sistema_miiase_app.controller;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import java.util.Map;
@RestControllerAdvice(assignableTypes={AdminUsersController.class, AuthController.class})
public class AdminExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<?> status(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", e.getReason() == null ? "Operação não permitida." : e.getReason()));
    }
    @ExceptionHandler({MethodArgumentNotValidException.class, org.springframework.http.converter.HttpMessageNotReadableException.class})
    ResponseEntity<?> invalid() { return ResponseEntity.badRequest().body(Map.of("message", "Confira os dados informados.")); }
}
