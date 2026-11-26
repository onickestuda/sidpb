package com.nca.sistema_miiase_app.service.submission;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

class PdfStorageServiceTest {
    @TempDir Path directory;

    @Test void deveArmazenarPdfComChaveGeradaSemUsarCaminhoDoCliente() throws Exception {
        var storage = new PdfStorageService(directory.toString());
        var pdf = new MockMultipartFile("pdf", "../../ARTIGO.PDF", "application/pdf", "%PDF-1.4\n%%EOF".getBytes());
        String key = storage.store(pdf);
        assertTrue(key.matches("[a-f0-9-]{36}\\.pdf"));
        assertArrayEquals(pdf.getBytes(), storage.load(key).getContentAsByteArray());
        storage.delete(key);
        assertFalse(directory.resolve(key).toFile().exists());
    }

    @Test void deveRejeitarTipoDeArquivoInvalido() {
        var pdf = new MockMultipartFile("pdf", "artigo.txt", "text/plain", "texto".getBytes());
        assertBadRequest(pdf);
    }

    @Test void deveRejeitarMimeInvalidoMesmoComExtensaoPdf() {
        assertBadRequest(new MockMultipartFile("pdf", "artigo.pdf", "text/plain", "%PDF-1.4".getBytes()));
    }

    @Test void deveRejeitarArquivoVazio() {
        assertBadRequest(new MockMultipartFile("pdf", "artigo.pdf", "application/pdf", new byte[0]));
    }

    @Test void deveRejeitarArquivoAcimaDe20MbSemCarregarNaMemoria() {
        MultipartFile pdf = mock(MultipartFile.class);
        when(pdf.getOriginalFilename()).thenReturn("artigo.pdf");
        when(pdf.getSize()).thenReturn(PdfStorageService.MAX_BYTES + 1);
        assertBadRequest(pdf);
    }

    @Test void deveImpedirCaminhoExternoNoDownload() {
        var storage = new PdfStorageService(directory.toString());
        var error = assertThrows(ResponseStatusException.class, () -> storage.load("../arquivo.pdf"));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    private void assertBadRequest(MultipartFile pdf) {
        var storage = new PdfStorageService(directory.toString());
        var error = assertThrows(ResponseStatusException.class, () -> storage.store(pdf));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }
}
