package com.nca.sistema_miiase_app.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.nca.sistema_miiase_app.service.extraction.ExtractionIngestionService;
import com.nca.sistema_miiase_app.service.extraction.ExtractionQueryService;

@RestController
public class ExtractionController {
    private final ExtractionIngestionService ingestion;
    private final ExtractionQueryService queries;

    public ExtractionController(ExtractionIngestionService ingestion, ExtractionQueryService queries) {
        this.ingestion = ingestion;
        this.queries = queries;
    }

    /**
     * Receives one extraction from the pipeline, in the same shape as a JSONL line:
     * {"id": "...", "model": "...", "sumarization": "<json text>" | {...}}. Always inserted; 201 when new,
     * 200 when the same id was already received.
     */
    @PostMapping("/api/admin/extracoes")
    public ResponseEntity<ExtractionIngestionService.Outcome> receive(@RequestBody ExtractionIngestionService.Payload payload) {
        var outcome = ingestion.ingest(payload);
        return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK).body(outcome);
    }

    @GetMapping("/api/curation/submissions/{id}/extracao")
    public ExtractionQueryService.ExtractionView detail(@PathVariable Integer id) {
        return queries.detail(id);
    }
}
