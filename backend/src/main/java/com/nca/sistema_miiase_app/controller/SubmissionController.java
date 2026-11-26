package com.nca.sistema_miiase_app.controller;

import java.io.IOException;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.nca.sistema_miiase_app.dto.submission.SubmissionDetailDto;
import com.nca.sistema_miiase_app.dto.submission.SubmissionPageDto;
import com.nca.sistema_miiase_app.dto.submission.SubmissionRequestDto;
import com.nca.sistema_miiase_app.service.submission.SubmissionService;

@RestController
@RequestMapping("/api/submissions")
public class SubmissionController {
    private final SubmissionService submissions;
    private final com.nca.sistema_miiase_app.service.auth.AuthService auth;
    public SubmissionController(SubmissionService submissions, com.nca.sistema_miiase_app.service.auth.AuthService auth) {
        this.submissions = submissions; this.auth = auth;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SubmissionDetailDto> create(@Valid @RequestPart("data") SubmissionRequestDto data,
            @RequestPart("pdf") MultipartFile pdf) {
        return ResponseEntity.status(201).body(submissions.create(
            new SubmissionRequestDto(auth.currentId(), data.originalLink(), data.userData()), pdf));
    }

    @GetMapping("/user/{userId}")
    public SubmissionPageDto list(@PathVariable Integer userId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return submissions.listByUser(auth.requireOwnId(userId), page, size);
    }

    @GetMapping("/{id}")
    public SubmissionDetailDto get(@PathVariable Integer id, @RequestParam Integer userId) {
        return submissions.getForUser(id, auth.requireOwnId(userId));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<Resource> pdf(@PathVariable Integer id, @RequestParam Integer userId) throws IOException {
        return pdfResponse(id, submissions.pdfForUser(id, auth.requireOwnId(userId)));
    }

    static ResponseEntity<Resource> pdfResponse(Integer id, Resource resource) throws IOException {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).contentLength(resource.contentLength())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename("artigo-" + id + ".pdf").build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store").body(resource);
    }
}
