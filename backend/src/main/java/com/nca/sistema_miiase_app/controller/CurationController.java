package com.nca.sistema_miiase_app.controller;

import java.io.IOException;
import java.time.LocalDate;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;
import com.nca.sistema_miiase_app.dto.curation.ApproveRequestDto;
import com.nca.sistema_miiase_app.dto.curation.RejectRequestDto;
import com.nca.sistema_miiase_app.dto.submission.SubmissionDetailDto;
import com.nca.sistema_miiase_app.dto.submission.SubmissionPageDto;
import com.nca.sistema_miiase_app.service.curation.CurationService;
import com.nca.sistema_miiase_app.service.submission.SubmissionService;

@RestController
@RequestMapping("/api/curation/submissions")
public class CurationController {
    private final SubmissionService submissions;
    private final CurationService curation;
    private final com.nca.sistema_miiase_app.service.auth.AuthService auth;
    public CurationController(SubmissionService submissions, CurationService curation,
            com.nca.sistema_miiase_app.service.auth.AuthService auth) {
        this.submissions = submissions;
        this.curation = curation;
        this.auth = auth;
    }

    @GetMapping
    public SubmissionPageDto list(@RequestParam(defaultValue = "PENDING") SubmissaoStatus status,
            @RequestParam(required = false) String title, @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String disease,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return submissions.list(null, status, title, year, disease, from, to, page, size);
    }

    @GetMapping("/{id}")
    public SubmissionDetailDto get(@PathVariable Integer id) { return submissions.get(id); }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> pdf(@PathVariable Integer id) throws IOException {
        return SubmissionController.pdfResponse(id, submissions.pdf(id));
    }

    @PostMapping("/{id}/approve")
    public SubmissionDetailDto approve(@PathVariable Integer id, @Valid @RequestBody ApproveRequestDto request) {
        return curation.approve(id, new ApproveRequestDto(auth.currentId(), request.curatedData()));
    }

    @PostMapping("/{id}/reject")
    public SubmissionDetailDto reject(@PathVariable Integer id, @Valid @RequestBody RejectRequestDto request) {
        return curation.reject(id, new RejectRequestDto(auth.currentId(), request.reason()));
    }
}
