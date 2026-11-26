package com.nca.sistema_miiase_app.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(assignableTypes = {SubmissionController.class, CurationController.class,
        ExtractionController.class, PipelineController.class})
public class SubmissionExceptionHandler {
    public record ErrorDto(String message) { }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorDto> status(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(new ErrorDto(exception.getReason()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            MissingServletRequestPartException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorDto> invalid(Exception exception) {
        return ResponseEntity.badRequest().body(new ErrorDto("Confira os campos obrigatórios, os limites e o PDF enviado."));
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ErrorDto> conflict(Exception exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorDto("Esta submissão foi alterada por outro curador. Atualize a fila."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorDto> unexpected(Exception exception) {
        org.slf4j.LoggerFactory.getLogger(SubmissionExceptionHandler.class).error("Falha no fluxo de submissão/curadoria.", exception);
        return ResponseEntity.internalServerError().body(new ErrorDto("Não foi possível concluir a operação. Tente novamente."));
    }
}
