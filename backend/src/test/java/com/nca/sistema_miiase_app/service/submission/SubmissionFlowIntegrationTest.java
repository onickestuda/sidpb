package com.nca.sistema_miiase_app.service.submission;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.nca.sistema_miiase_app.domain.entity.ExtractionStatus;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;
import com.nca.sistema_miiase_app.domain.repository.FonteRepository;
import com.nca.sistema_miiase_app.domain.repository.OcorrenciaRepository;
import com.nca.sistema_miiase_app.domain.repository.SubmissaoArtigoRepository;
import com.nca.sistema_miiase_app.domain.repository.UsuarioRepository;
import com.nca.sistema_miiase_app.dto.curation.ApproveRequestDto;
import com.nca.sistema_miiase_app.dto.curation.RejectRequestDto;
import com.nca.sistema_miiase_app.dto.submission.ArticleDataDto;
import com.nca.sistema_miiase_app.dto.submission.SubmissionDetailDto;
import com.nca.sistema_miiase_app.dto.submission.SubmissionRequestDto;
import com.nca.sistema_miiase_app.service.curation.CurationService;
import com.nca.sistema_miiase_app.service.extraction.DocumentExtractionService;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Transactional
class SubmissionFlowIntegrationTest {
    @TempDir static Path storageDirectory;
    @DynamicPropertySource static void storage(DynamicPropertyRegistry registry) {
        registry.add("sidpb.storage.submissions-dir", () -> storageDirectory.toString());
    }
    @Autowired SubmissionService submissions;
    @Autowired CurationService curation;
    @Autowired SubmissaoArtigoRepository repository;
    @Autowired UsuarioRepository users;
    @Autowired PdfStorageService storage;
    @Autowired FonteRepository fontes;
    @Autowired OcorrenciaRepository ocorrencias;
    @MockitoSpyBean DocumentExtractionService extraction;

    @Test void deveCriarSubmissaoPdfEDadosSeparadosNoPostgres() throws Exception {
        var created = create("Artigo enviado");
        assertEquals(SubmissaoStatus.PENDING, created.status());
        assertEquals("Artigo enviado", created.userData().title());
        assertNotEquals(created.userData(), created.llmData());
        assertTrue(created.extractionMock());
        assertEquals("sidpb-mock-v1", created.extractionModel());
        assertEquals(ExtractionStatus.COMPLETED, created.extractionStatus());
        assertNotNull(created.createdAt());
        assertNotNull(created.extractedAt());
        assertEquals("https://doi.org/10.1234/teste", created.originalLink());
        var entity = repository.findById(created.id()).orElseThrow();
        assertFalse(Path.of(entity.getPdfPath()).isAbsolute());
        assertArrayEquals(pdf().getBytes(), storage.load(entity.getPdfPath()).getContentAsByteArray());
    }

    @Test void deveRejeitarLinkQueNaoSejaHttpOuHttps() {
        var error = assertThrows(ResponseStatusException.class, () -> submissions.create(
                new SubmissionRequestDto(userId(), "javascript:alert(1)", data("Artigo")), pdf()));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test void deveRejeitarArquivoFalsamenteRenomeadoParaPdf() {
        var falsePdf = new MockMultipartFile("pdf", "teste.pdf", "application/pdf", "texto".getBytes());
        var error = assertThrows(ResponseStatusException.class, () -> submissions.create(request("Artigo"), falsePdf));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        assertEquals(0, repository.count());
    }

    @Test void deveListarApenasSubmissoesDoUsuarioInformado() {
        var created = create("Do usuário");
        Integer otherId = users.findByEmail("admin@sidpb.local").orElseThrow().getId();
        submissions.create(new SubmissionRequestDto(otherId, "https://example.org/artigo", data("Outro usuário")), pdf());
        var page = submissions.listByUser(userId(), 0, 10);
        assertEquals(1, page.totalElements());
        assertEquals(created.id(), page.items().getFirst().id());
    }

    @Test void deveBuscarDetalhesEImpedirConsultaComOutroIdDeUsuario() {
        var created = create("Detalhes");
        assertEquals(created, submissions.getForUser(created.id(), userId()));
        var error = assertThrows(ResponseStatusException.class, () -> submissions.getForUser(created.id(), curatorId()));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test void deveFiltrarFilaPorStatusTituloAnoDoencaEData() {
        var created = create("Leishmaniose em cães");
        var today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        var page = submissions.list(null, SubmissaoStatus.PENDING, "cães", 2024, "leishmaniose", today, today, 0, 10);
        assertEquals(1, page.totalElements());
        assertEquals(created.id(), page.items().getFirst().id());
        assertEquals(0, submissions.list(null, SubmissaoStatus.APPROVED, null, null, null, null, null, 0, 10).totalElements());
    }

    @Test void devePaginarETratarCuringasDaBuscaComoTexto() {
        create("100% de teste"); create("Outro artigo");
        assertEquals(2, submissions.listByUser(userId(), 0, 1).totalPages());
        assertEquals(1, submissions.list(null, SubmissaoStatus.PENDING, "%", null, null, null, null, 0, 10).totalElements());
    }

    @Test void deveAprovarRegistrarCuradorDataESnapshotSemPublicarOcorrencias() {
        long fontesBefore = fontes.count(), ocorrenciasBefore = ocorrencias.count();
        var created = create("Original");
        var approved = curation.approve(created.id(), new ApproveRequestDto(curatorId(), data("Título corrigido")));
        assertEquals(SubmissaoStatus.APPROVED, approved.status());
        assertEquals(curatorId(), approved.reviewedBy().id());
        assertNotNull(approved.reviewedAt());
        assertEquals("Título corrigido", approved.curatedData().title());
        assertEquals("Original", approved.userData().title());
        assertEquals(created.llmData(), approved.llmData());
        assertNull(approved.rejectionReason());
        assertEquals(fontesBefore, fontes.count()); assertEquals(ocorrenciasBefore, ocorrencias.count());
        assertEquals(1, submissions.list(null, SubmissaoStatus.APPROVED, null, null, null, null, null, 0, 10).totalElements());
    }

    @Test void deveReprovarERegistrarMotivoNoHistorico() {
        var created = create("Reprovar");
        var rejected = curation.reject(created.id(), new RejectRequestDto(curatorId(), "  Fonte sem evidências suficientes.  "));
        assertEquals(SubmissaoStatus.REJECTED, rejected.status());
        assertEquals("Fonte sem evidências suficientes.", rejected.rejectionReason());
        assertEquals(curatorId(), rejected.reviewedBy().id()); assertNotNull(rejected.reviewedAt());
        assertEquals(1, submissions.list(null, SubmissaoStatus.REJECTED, null, null, null, null, null, 0, 10).totalElements());
    }

    @Test void deveExigirMotivoParaReprovar() {
        var created = create("Pendente");
        var error = assertThrows(ResponseStatusException.class,
                () -> curation.reject(created.id(), new RejectRequestDto(curatorId(), "  ")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test void deveImpedirSegundaDecisao() {
        var created = create("Decisão única");
        curation.approve(created.id(), new ApproveRequestDto(curatorId(), data("Revisado")));
        var error = assertThrows(ResponseStatusException.class,
                () -> curation.reject(created.id(), new RejectRequestDto(curatorId(), "Alterar")));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test void deveManterSubmissaoPendenteSeExtracaoFalhar() {
        doThrow(new IllegalStateException("Serviço indisponível")).when(extraction).extract(any());
        var created = create("Revisão manual");
        assertEquals(SubmissaoStatus.PENDING, created.status());
        assertEquals(ExtractionStatus.FAILED, created.extractionStatus());
        assertNull(created.llmData()); assertEquals("Revisão manual", created.userData().title());
    }

    @Test void deveRejeitarPaginacaoInvalida() {
        var error = assertThrows(ResponseStatusException.class, () -> submissions.listByUser(userId(), -1, 10));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test void deveBloquearAutoavaliacaoInclusiveParaCurador() {
        var own = submissions.create(new SubmissionRequestDto(curatorId(), "https://example.org", data("Próprio artigo")), pdf());
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
            () -> curation.approve(own.id(), new ApproveRequestDto(curatorId(), data("Próprio artigo")))).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
            () -> curation.reject(own.id(), new RejectRequestDto(curatorId(), "Revisão própria"))).getStatusCode());
    }

    private SubmissionDetailDto create(String title) { return submissions.create(request(title), pdf()); }
    private SubmissionRequestDto request(String title) { return new SubmissionRequestDto(userId(), "https://doi.org/10.1234/teste", data(title)); }
    private Integer userId() { return users.findByEmail("usuario@sidpb.local").orElseThrow().getId(); }
    private Integer curatorId() { return users.findByEmail("curador@sidpb.local").orElseThrow().getId(); }
    static ArticleDataDto data(String title) {
        return new ArticleDataDto(title, List.of("Autora"), 2024, null, "Leishmaniose", null, null, null,
                "MA", "São Luís", null, null, "Revista", "Observação do usuário");
    }
    static MockMultipartFile pdf() {
        return new MockMultipartFile("pdf", "artigo.pdf", "application/pdf", "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF".getBytes(StandardCharsets.US_ASCII));
    }
}
