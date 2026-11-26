package com.nca.sistema_miiase_app.controller;

import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.nca.sistema_miiase_app.service.extraction.ExtractionIngestionService;
import com.nca.sistema_miiase_app.service.extraction.PipelineQueueService;

/** API used by the extraction worker (Keycloak client "sidpb-pipeline", role PIPELINE). */
@RestController
@RequestMapping("/api/pipeline")
public class PipelineController {
    private final PipelineQueueService queue;
    private final ExtractionIngestionService ingestion;

    public PipelineController(PipelineQueueService queue, ExtractionIngestionService ingestion) {
        this.queue = queue;
        this.ingestion = ingestion;
    }

    /** Articles found by the team (RAG): each extraction becomes a new submission. */
    @PostMapping("/extracoes")
    public ResponseEntity<ExtractionIngestionService.Outcome> receive(@RequestBody ExtractionIngestionService.Payload payload) {
        var outcome = ingestion.ingest(payload);
        return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK).body(outcome);
    }

    /** Claims up to {@code limite} PDFs submitted by people that still need extraction. */
    @PostMapping("/trabalhos/reservar")
    public List<PipelineQueueService.Job> claim(@RequestParam(name = "limite", defaultValue = "5") int limit) {
        return queue.claim(limit);
    }

    @GetMapping("/trabalhos/{id}/pdf")
    public ResponseEntity<Resource> pdf(@PathVariable Integer id) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"submissao-" + id + ".pdf\"")
                .body(queue.pdf(id));
    }

    /** Result for the SAME submission the job came from. */
    @PostMapping("/trabalhos/{id}/resultado")
    public ResponseEntity<ExtractionIngestionService.Outcome> result(@PathVariable Integer id,
                                                                     @RequestBody ExtractionIngestionService.Payload payload) {
        var outcome = ingestion.attach(id, payload);
        return ResponseEntity.status(outcome.created() ? HttpStatus.CREATED : HttpStatus.OK).body(outcome);
    }

    @PostMapping("/trabalhos/{id}/devolver")
    public ResponseEntity<Void> release(@PathVariable Integer id) {
        queue.release(id);
        return ResponseEntity.noContent().build();
    }
}
