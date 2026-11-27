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

    private final boolean pipelineMode;

    public SubmissionService(SubmissaoArtigoRepository repository, UsuarioRepository usuarios,
            PdfStorageService storage, DocumentExtractionService extraction,
            @org.springframework.beans.factory.annotation.Value("${sidpb.extraction.mode:mock}") String extractionMode) {
        this.pipelineMode = "pipeline".equalsIgnoreCase(extractionMode);
        this.repository = repository;
        this.usuarios = usuarios;
        this.storage = storage;
        this.extraction = extraction;
    }

    @Transactional
    public SubmissionDetailDto create(SubmissionRequestDto request, MultipartFile pdf) {
        // Source: the PDF, the original link, or both (at least one).
        String link = request.originalLink() == null || request.originalLink().isBlank() ? null : request.originalLink().strip();
        boolean hasPdf = pdf != null && !pdf.isEmpty();
        if (!hasPdf && link == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Envie o PDF do artigo ou o link da fonte original.");
        if (link != null) validateLink(link);
        validateCoordinates(request.userData());
        Usuario usuario = findActor(request.userId());
        SubmissaoArtigo submission = new SubmissaoArtigo();
        submission.setUsuario(usuario);
        submission.setTitulo(displayTitle(request.userData().title(), hasPdf ? pdf.getOriginalFilename() : null, link));
        submission.setLinkOriginal(link);
        submission.setDadosUsuario(request.userData());
        submission.setAno(request.userData().year());
        submission.setDoenca(request.userData().firstDisease());
        if (!hasPdf) {
            // Link only: no file to read, so no automatic extraction; the curator works from the link.
            submission.setExtractionStatus(ExtractionStatus.FAILED);
            return detail(repository.saveAndFlush(submission));
        }
        String key = storage.store(pdf);
        // A transação do banco pode falhar inclusive no commit: remover o arquivo nesse caso.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.delete(key);
            }
        });
        submission.setPdfPath(key);
        String originalName = pdf.getOriginalFilename() == null ? "artigo.pdf" : pdf.getOriginalFilename().replace('\\', '/');
        originalName = originalName.substring(originalName.lastIndexOf('/') + 1);
        submission.setPdfNome(originalName.isBlank() || originalName.length() > 255 ? "artigo.pdf" : originalName);
        submission.setPdfTamanho(pdf.getSize());
        submission.setPdfSha256(sha256(pdf));
        if (pipelineMode) {
            // The real extraction runs in the pipeline worker, which claims this submission from the queue.
            submission.setExtractionStatus(ExtractionStatus.PENDING);
            return detail(repository.saveAndFlush(submission));
        }
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
        return list(userId, status, title, year, disease, from, to, page, size, null);
    }

    /** onlyIds: restriction computed from the specialty facets (null = no restriction). */
    public SubmissionPageDto list(Integer userId, SubmissaoStatus status, String title, Integer year,
            String disease, LocalDate from, LocalDate to, int page, int size, java.util.Set<Integer> onlyIds) {
        if (page < 0 || size < 1 || size > 100 || (from != null && to != null && from.isAfter(to))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paginação ou intervalo de datas inválido.");
        }
        Specification<SubmissaoArtigo> filters = (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (userId != null) predicates.add(cb.equal(root.get("usuario").get("id"), userId));
            if (onlyIds != null) predicates.add(onlyIds.isEmpty() ? cb.disjunction() : root.get("id").in(onlyIds));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            // Case- and accent-insensitive, like the map search: "miiase" finds "Miíase".
            if (title != null && !title.isBlank()) predicates.add(cb.like(folded(cb, root.<String>get("titulo")), contains(title), '\\'));
            if (year != null) predicates.add(cb.equal(root.get("ano"), year));
            if (disease != null && !disease.isBlank()) predicates.add(cb.like(folded(cb, root.<String>get("doenca")), contains(disease), '\\'));
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
    public Resource pdfForUser(Integer id, Integer userId) { return storage.load(pdfPath(findForUser(id, userId))); }
    public Resource pdf(Integer id) { return storage.load(pdfPath(find(id))); }

    private static String pdfPath(SubmissaoArtigo submission) {
        if (submission.getPdfPath() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Esta submissão não tem PDF anexado.");
        }
        return submission.getPdfPath();
    }

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
                s.getDadosCurados(), PersonDto.codeOnly(s.getCurador()), s.getReviewedAt(), s.getRejectionReason(), s.getOrigem());
    }

    private static String sha256(MultipartFile pdf) {
        try (var input = pdf.getInputStream()) {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            for (int read; (read = input.read(buffer)) > 0; ) digest.update(buffer, 0, read);
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (Exception unavailable) {
            return null; // the hash only helps duplicate detection; never block the submission
        }
    }

    public static void validateCoordinates(ArticleDataDto data) {
        if (data.occurrences() != null) {
            int index = 0;
            for (var occurrence : data.occurrences()) {
                index++;
                if (occurrence != null && (occurrence.latitude() == null) != (occurrence.longitude() == null)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Ocorrência " + index + ": informe latitude e longitude juntas ou deixe ambas vazias.");
                }
            }
        }
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
                s.getCreatedAt(), person(s.getUsuario()), PersonDto.codeOnly(s.getCurador()), s.getReviewedAt(), s.getOrigem());
    }

    private PersonDto person(Usuario user) { return PersonDto.of(user); }

    private static final String ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüçñ";
    private static final String PLAIN = "aaaaaeeeeiiiiooooouuuucn";

    /** lower() + accents removed in the database, matching fold() on the search text. */
    private static jakarta.persistence.criteria.Expression<String> folded(
            jakarta.persistence.criteria.CriteriaBuilder cb, jakarta.persistence.criteria.Expression<String> column) {
        return cb.function("translate", String.class, cb.lower(column), cb.literal(ACCENTED), cb.literal(PLAIN));
    }

    static String fold(String input) {
        return java.text.Normalizer.normalize(input.strip().toLowerCase(Locale.ROOT), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }

    private String contains(String input) {
        return "%" + fold(input).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** The title is optional: fall back to the PDF name (without .pdf), then the link, so the queue never shows a blank title. */
    static String displayTitle(String title, String pdfName, String link) {
        if (title != null && !title.isBlank()) return title.strip();
        if (pdfName != null && !pdfName.isBlank()) {
            String name = pdfName.replace('\\', '/');
            name = name.substring(name.lastIndexOf('/') + 1).replaceFirst("(?i)\\.pdf$", "").strip();
            if (!name.isBlank()) return name.length() > 500 ? name.substring(0, 500) : name;
        }
        if (link != null) return link.length() > 500 ? link.substring(0, 500) : link;
        return "Sem título";
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
