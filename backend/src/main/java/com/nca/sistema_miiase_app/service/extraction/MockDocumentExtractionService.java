package com.nca.sistema_miiase_app.service.extraction;

import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Service;
import com.nca.sistema_miiase_app.dto.submission.ArticleDataDto;

@Service
public class MockDocumentExtractionService implements DocumentExtractionService {
    @Override
    public ExtractionResult extract(Path pdf) {
        // MOCK: não lê nem interpreta o PDF; estes valores são uma fixture de teste.
        return new ExtractionResult(new ArticleDataDto(
                "Artigo de demonstração — extração mock", List.of("Autor de teste"), 2024,
                null, "Leishmaniose visceral", "Leishmania infantum", null, "Canis familiaris",
                "MA", "São Luís", null, null, "Fonte simulada",
                "MOCK de desenvolvimento: dados fictícios, não extraídos deste PDF."
        ), "sidpb-mock-v1", true);
    }
}
