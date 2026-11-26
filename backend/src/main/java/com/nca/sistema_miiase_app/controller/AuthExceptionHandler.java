package com.nca.sistema_miiase_app.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import com.nca.sistema_miiase_app.dto.response.auth.AuthErrorResponseDto;

// Contrato local ao login: não altera respostas dos endpoints públicos existentes.
@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<AuthErrorResponseDto> handleStatus(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
                .body(new AuthErrorResponseDto(exception.getReason()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<AuthErrorResponseDto> handleInvalidInput(Exception exception) {
        // Não expor valores rejeitados: podem conter senha.
        return ResponseEntity.badRequest()
                .body(new AuthErrorResponseDto("Informe um e-mail válido e uma senha não vazia."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<AuthErrorResponseDto> handleUnexpected(Exception exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new AuthErrorResponseDto("Não foi possível realizar o login. Tente novamente."));
    }
}
