package com.nca.sistema_miiase_app.controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.nca.sistema_miiase_app.domain.entity.ExtractionStatus;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoStatus;
import com.nca.sistema_miiase_app.dto.submission.*;
import com.nca.sistema_miiase_app.service.curation.CurationService;
import com.nca.sistema_miiase_app.service.submission.SubmissionService;

@org.springframework.context.annotation.Import(com.nca.sistema_miiase_app.config.SecurityConfig.class)
@WebMvcTest({SubmissionController.class, CurationController.class})
@org.springframework.security.test.context.support.WithMockUser(roles={"USER","CURATOR","ADMIN"})
class SubmissionControllersTest {
    @MockitoBean org.springframework.security.oauth2.jwt.JwtDecoder jwtDecoder;
    @Autowired MockMvc mvc;
    @Autowired org.springframework.web.context.WebApplicationContext context;
    @MockitoBean SubmissionService submissions;
    @MockitoBean CurationService curation;
    @MockitoBean com.nca.sistema_miiase_app.service.curation.CurationFacetService facets;
    @MockitoBean com.nca.sistema_miiase_app.service.auth.AuthService auth;
    @org.junit.jupiter.api.BeforeEach void identity() {
        mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup(context).apply(org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity()).build();
        when(auth.currentId()).thenReturn(3);
        when(auth.requireOwnId(anyInt())).thenAnswer(call -> call.getArgument(0));
    }

    @Test void deveAceitarMultipartERetornarSomenteDtoSemCaminhoOuCredenciais() throws Exception {
        when(submissions.create(any(), any())).thenReturn(detail());
        mvc.perform(multipart("/api/submissions").file(pdf()).file(data("""
                {"userId":3,"originalLink":"https://example.org","userData":{"title":"Artigo","authors":[]}}
                """)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.userData.title").value("Artigo"))
                .andExpect(jsonPath("$.extractionMock").value(true))
                .andExpect(jsonPath("$.pdfPath").doesNotExist())
                .andExpect(jsonPath("$.pdf_path").doesNotExist())
                .andExpect(jsonPath("$.submittedBy.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.submittedBy.email").doesNotExist());
    }

    @Test void deveExigirTituloEUsuarioNoMultipart() throws Exception {
        mvc.perform(multipart("/api/submissions").file(pdf()).file(data("""
                {"originalLink":"https://example.org","userData":{"title":""}}
                """))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
        verifyNoInteractions(submissions);
    }

    @Test void deveExigirPdfOuLink() throws Exception {
        mvc.perform(multipart("/api/submissions").file(data("""
                {"userId":3,"originalLink":"  ","userData":{"title":"Artigo"}}
                """))).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Envie o PDF do artigo ou o link da fonte original."));
        verifyNoInteractions(submissions);
    }

    @Test void deveAceitarSomenteOLink() throws Exception {
        when(submissions.create(any(), any())).thenReturn(detail());
        mvc.perform(multipart("/api/submissions").file(data("""
                {"userId":3,"originalLink":"https://example.org","userData":{"title":"Artigo"}}
                """))).andExpect(status().isCreated());
        verify(submissions).create(argThat(request -> "https://example.org".equals(request.originalLink())), isNull());
    }

    @Test void deveAceitarSomenteOPdf() throws Exception {
        when(submissions.create(any(), any())).thenReturn(detail());
        mvc.perform(multipart("/api/submissions").file(pdf()).file(data("""
                {"userId":3,"userData":{"title":"Artigo"}}
                """))).andExpect(status().isCreated());
        verify(submissions).create(argThat(request -> request.originalLink() == null), notNull());
    }

    @Test void deveServirPdfSemExporCaminhoDoFilesystem() throws Exception {
        when(submissions.pdfForUser(7, 3)).thenReturn(new ByteArrayResource("%PDF-1.4".getBytes()));
        mvc.perform(get("/api/submissions/7/pdf").param("userId", "3"))
                .andExpect(status().isOk()).andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Content-Disposition", "inline; filename=\"artigo-7.pdf\""));
    }

    @Test void deveListarFilaComPaginacao() throws Exception {
        when(facets.matching(org.mockito.ArgumentMatchers.any())).thenReturn(null); // no specialty selected
        when(submissions.list(isNull(), eq(SubmissaoStatus.PENDING), isNull(), isNull(), isNull(), isNull(), isNull(), eq(0), eq(20), isNull()))
                .thenReturn(new SubmissionPageDto(List.of(), 0, 20, 0, 0));
        mvc.perform(get("/api/curation/submissions"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test void deveRejeitarStatusInvalidoNaFila() throws Exception {
        mvc.perform(get("/api/curation/submissions").param("status", "OUTRO"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(submissions);
    }

    @Test void deveExigirMotivoNaReprovacao() throws Exception {
        mvc.perform(post("/api/curation/submissions/7/reject").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"curatorId\":2,\"reason\":\"  \"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(curation);
    }

    @Test void deveExigirDadosCuradosNaAprovacao() throws Exception {
        mvc.perform(post("/api/curation/submissions/7/approve").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"curatorId\":2}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(curation);
    }

    @Test void deveOcultarDetalhesInternosEmErro() throws Exception {
        when(submissions.get(7)).thenThrow(new IllegalStateException("Caminho interno do storage"));
        mvc.perform(get("/api/curation/submissions/7"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("Não foi possível concluir a operação. Tente novamente."))
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    private MockMultipartFile data(String json) { return new MockMultipartFile("data", "data.json", "application/json", json.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
    private MockMultipartFile pdf() { return new MockMultipartFile("pdf", "artigo.pdf", "application/pdf", "%PDF-1.4".getBytes()); }
    private SubmissionDetailDto detail() {
        var article = new ArticleDataDto("Artigo", List.of(), null, null, null, null, null, null, null, null, null, null, null, null);
        var time = Instant.parse("2026-10-07T12:00:00Z");
        return new SubmissionDetailDto(7, "Artigo", "https://example.org", "artigo.pdf", 100L, SubmissaoStatus.PENDING,
                time, time, new PersonDto(3, "Usuário", "A1B2C3"), article, article, ExtractionStatus.COMPLETED, time, "mock", true, null, null, null, null, "USUARIO");
    }
}
