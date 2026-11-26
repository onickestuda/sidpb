package com.nca.sistema_miiase_app.service.submission;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

// Fronteira de armazenamento: substituir este serviço por storage externo futuramente.
@Service
public class PdfStorageService {
    public static final long MAX_BYTES = 20L * 1024 * 1024;
    private final Path root;

    public PdfStorageService(@Value("${sidpb.storage.submissions-dir:./storage/submissions}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }

    public String store(MultipartFile file) {
        String filename = file.getOriginalFilename();
        if (file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um PDF não vazio de até 20 MB.");
        }
        if (filename == null || !filename.toLowerCase(Locale.ROOT).endsWith(".pdf")
                || !"application/pdf".equalsIgnoreCase(file.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O arquivo deve ser um PDF (application/pdf).");
        }
        String key = UUID.randomUUID() + ".pdf";
        Path target = resolve(key);
        try (var input = file.getInputStream()) {
            byte[] signature = input.readNBytes(5);
            if (!"%PDF-".equals(new String(signature, StandardCharsets.US_ASCII))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O arquivo não possui uma assinatura PDF válida.");
            }
            Files.createDirectories(root);
            try (var output = Files.newOutputStream(target)) {
                output.write(signature);
                input.transferTo(output);
            }
            return key;
        } catch (IOException ex) {
            delete(key);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível armazenar o PDF.");
        }
    }

    public Resource load(String key) {
        Path file = resolve(key);
        if (!Files.isRegularFile(file)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "PDF não encontrado no armazenamento.");
        }
        return new FileSystemResource(file);
    }

    public void delete(String key) {
        try { Files.deleteIfExists(resolve(key)); }
        catch (IOException ex) {
            org.slf4j.LoggerFactory.getLogger(PdfStorageService.class).warn("Não foi possível remover PDF após rollback.");
        }
    }

    private Path resolve(String key) {
        // A chave é gerada internamente; nunca usar o nome recebido como caminho.
        if (key == null || !key.matches("[a-f0-9-]{36}\\.pdf")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "PDF não encontrado.");
        }
        return root.resolve(key);
    }
}
