package com.nca.sistema_miiase_app.service.extraction;

import java.nio.file.Path;
import com.nca.sistema_miiase_app.dto.submission.ArticleDataDto;

// Uma implementação futura de LLM pode substituir o mock sem alterar a API/telas.
public interface DocumentExtractionService {
    ExtractionResult extract(Path pdf);
    record ExtractionResult(ArticleDataDto data, String model, boolean mock) { }
}
