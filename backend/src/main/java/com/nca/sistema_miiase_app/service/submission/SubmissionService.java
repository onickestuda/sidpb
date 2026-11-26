package com.nca.sistema_miiase_app.service.submission;

import java.net.URI;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Locale;

import jakarta.persistence.criteria.Predicate;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.nca.sistema_miiase_app.domain.entity.ExtractionStatus;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoArtigo;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;
import com.nca.sistema_miiase_app.domain.entity.Usuario;
import com.nca.sistema_miiase_app.domain.repository.SubmissaoArtigoRepository;
import com.nca.sistema_miiase_app.domain.repository.UsuarioRepository;
import com.nca.sistema_miiase_app.dto.submission.*;
import com.nca.sistema_miiase_app.service.extraction.DocumentExtractionService;

@Service
@Transactional(readOnly = true)
public class SubmissionService {
    private final SubmissaoArtigoRepository repository;
    private final UsuarioRepository usuarios;
    private final PdfStorageService storage;
    private final DocumentExtractionService extraction;

    public SubmissionService(SubmissaoArtigoRepository repository, UsuarioRepository usuarios,
            PdfStorageService storage, DocumentExtractionService extraction) {
        this.repository = repository;
        this.usuarios = usuarios;
        this.storage = storage;
        this.extraction = extraction;
    }

    @Transactional
    public SubmissionDetailDto create(SubmissionRequestDto request, MultipartFile pdf) {
        String link = request.originalLink().strip();
        validateLink(link);
        validateCoordinates(request.userData());
        Usuario usuario = findActor(request.userId());
        String key = storage.store(pdf);
        // A transação do banco pode falhar inclusive no commit: remover o arquivo nesse caso.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.delete(key);
            }
        });
        SubmissaoArtigo submission = new SubmissaoArtigo();
        submission.setUsuario(usuario);
        submission.setTitulo(request.userData().title());
        submission.setLinkOriginal(link);
        submission.setPdfPath(key);
        String originalName = pdf.getOriginalFilename().replace('\\', '/');
        originalName = originalName.substring(originalName.lastIndexOf('/') + 1);
        submission.setPdfNome(originalName.length() > 255 ? "artigo.pdf" : originalName);
        submission.setPdfTamanho(pdf.getSize());
        submission.setDadosUsuario(request.userData());
        submission.setAno(request.userData().year());
        submission.setDoenca(request.userData().disease());
        try {
            Path localPdf = storage.load(key).getFile().toPath();
            var result = extraction.extract(localPdf);
            submission.setDadosLlm(result.data());
            submission.setExtractionModel(result.model());
            submission.setExtractionMock(result.mock());
            submission.setExtractionStatus(ExtractionStatus.COMPLETED);
            submission.setExtractedAt(Instant.now());
        } catch (Exception ex) {
            // A submissão continua disponível para revisão manual se a extração falhar.
            submission.setExtractionStatus(ExtractionStatus.FAILED);
            org.slf4j.LoggerFactory.getLogger(SubmissionService.class).warn("Extração indisponível; submissão será revisada manualmente.");
        }
        return detail(repository.saveAndFlush(submission));
    }

    public SubmissionPageDto listByUser(Integer userId, int page, int size) {
        findActor(userId);
        return list(userId, null, null, null, null, null, null, page, size);
    }

    public SubmissionPageDto list(Integer userId, SubmissaoStatus status, String title, Integer year,
            String disease, LocalDate from, LocalDate to, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (from != null && to != null && from.isAfter(to))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paginação ou intervalo de datas inválido.");
        }
        Specification<SubmissaoArtigo> filters = (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (userId != null) predicates.add(cb.equal(root.get("usuario").get("id"), userId));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (title != null && !title.isBlank()) predicates.add(cb.like(cb.lower(root.get("titulo")), contains(title), '\\'));
            if (year != null) predicates.add(cb.equal(root.get("ano"), year));
            if (disease != null && !disease.isBlank()) predicates.add(cb.like(cb.lower(root.get("doenca")), contains(disease), '\\'));
            ZoneId timezone = ZoneId.of("America/Sao_Paulo");
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay(timezone).toInstant()));
            if (to != null) predicates.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay(timezone).toInstant()));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"));
        return SubmissionPageDto.from(repository.findAll(filters, pageable).map(this::summary));
    }

    public SubmissionDetailDto getForUser(Integer id, Integer userId) { return detail(findForUser(id, userId)); }
    public SubmissionDetailDto get(Integer id) { return detail(find(id)); }
    public Resource pdfForUser(Integer id, Integer userId) { return storage.load(findForUser(id, userId).getPdfPath()); }
    public Resource pdf(Integer id) { return storage.load(find(id).getPdfPath()); }

    public SubmissaoArtigo find(Integer id) {
        return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submissão não encontrada."));
    }

    public Usuario findActor(Integer id) {
        return usuarios.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuário informado não existe."));
    }

    public SubmissionDetailDto detail(SubmissaoArtigo s) {
        return new SubmissionDetailDto(s.getId(), s.getTitulo(), s.getLinkOriginal(), s.getPdfNome(), s.getPdfTamanho(),
                s.getStatus(), s.getCreatedAt(), s.getUpdatedAt(), person(s.getUsuario()), s.getDadosUsuario(), s.getDadosLlm(),
                s.getExtractionStatus(), s.getExtractedAt(), s.getExtractionModel(), s.isExtractionMock(),
                s.getDadosCurados(), person(s.getCurador()), s.getReviewedAt(), s.getRejectionReason());
    }

    public static void validateCoordinates(ArticleDataDto data) {
        if ((data.latitude() == null) != (data.longitude() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe latitude e longitude juntas ou deixe ambas vazias.");
        }
    }

    private SubmissaoArtigo findForUser(Integer id, Integer userId) {
        return repository.findByIdAndUsuarioId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Submissão não encontrada para este usuário."));
    }

    private SubmissionSummaryDto summary(SubmissaoArtigo s) {
        return new SubmissionSummaryDto(s.getId(), s.getTitulo(), s.getLinkOriginal(), s.getStatus(),
                s.getCreatedAt(), person(s.getUsuario()), person(s.getCurador()), s.getReviewedAt());
    }

    private PersonDto person(Usuario user) { return PersonDto.of(user); }

    private String contains(String input) {
        return "%" + input.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private void validateLink(String link) {
        try {
            URI uri = URI.create(link);
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um link original válido (http ou https).");
        }
    }
}
