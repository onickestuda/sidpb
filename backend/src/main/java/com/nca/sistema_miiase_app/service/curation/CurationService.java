package com.nca.sistema_miiase_app.service.curation;

import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.nca.sistema_miiase_app.domain.entity.SubmissaoArtigo;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;
import com.nca.sistema_miiase_app.domain.repository.SubmissaoArtigoRepository;
import com.nca.sistema_miiase_app.dto.curation.ApproveRequestDto;
import com.nca.sistema_miiase_app.dto.curation.RejectRequestDto;
import com.nca.sistema_miiase_app.dto.submission.SubmissionDetailDto;
import com.nca.sistema_miiase_app.service.submission.SubmissionService;

@Service
@Transactional
public class CurationService {
    private final SubmissionService submissions;
    private final SubmissaoArtigoRepository repository;

    public CurationService(SubmissionService submissions, SubmissaoArtigoRepository repository) {
        this.submissions = submissions;
        this.repository = repository;
    }

    public SubmissionDetailDto approve(Integer id, ApproveRequestDto request) {
        SubmissionService.validateCoordinates(request.curatedData());
        SubmissaoArtigo submission = pending(id, request.curatorId());
        submission.setStatus(SubmissaoStatus.APPROVED);
        submission.setDadosCurados(request.curatedData());
        // Não inserir em fonte/ocorrencia; manter snapshot final para publicação futura.
        return submissions.detail(repository.saveAndFlush(submission));
    }

    public SubmissionDetailDto reject(Integer id, RejectRequestDto request) {
        if (request.reason() == null || request.reason().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o motivo da reprovação.");
        }
        SubmissaoArtigo submission = pending(id, request.curatorId());
        submission.setStatus(SubmissaoStatus.REJECTED);
        submission.setRejectionReason(request.reason().strip());
        return submissions.detail(repository.saveAndFlush(submission));
    }

    private SubmissaoArtigo pending(Integer id, Integer curatorId) {
        SubmissaoArtigo submission = submissions.find(id);
        // Self-review is allowed: /api/curation already requires CURATOR (ADMIN inherits it).
        // The decision is stamped with the curator (name + public code) and flagged as self-review in the UI.
        if (submission.getStatus() != SubmissaoStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Esta submissão já recebeu uma decisão. Atualize a fila.");
        }
        submission.setCurador(submissions.findActor(curatorId));
        submission.setReviewedAt(Instant.now());
        return submission;
    }
}
