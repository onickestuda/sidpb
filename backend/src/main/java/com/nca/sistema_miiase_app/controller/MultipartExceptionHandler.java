package com.nca.sistema_miiase_app.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

// Multipart é lido antes da seleção do controller, portanto este handler é global
// apenas para o limite de upload. Não muda respostas de login/mapa/ocorrências.
@RestControllerAdvice
public class MultipartExceptionHandler {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<SubmissionExceptionHandler.ErrorDto> tooLarge(Exception exception) {
        return ResponseEntity.status(413).body(new SubmissionExceptionHandler.ErrorDto("O PDF deve ter no máximo 20 MB."));
    }
}
