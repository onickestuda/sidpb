package com.nca.sistema_miiase_app.service.submission;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SubmissionTitleTest {
    @Test void usaOTituloInformado() {
        assertThat(SubmissionService.displayTitle("  Miíase em bovinos ", "arquivo.pdf", "https://doi.org/x")).isEqualTo("Miíase em bovinos");
    }

    @Test void semTituloUsaONomeDoPdfSemExtensao() {
        assertThat(SubmissionService.displayTitle(" ", "C:\\artigos\\Silva 2020 - Miiase.PDF", "https://doi.org/x"))
                .isEqualTo("Silva 2020 - Miiase");
    }

    @Test void semTituloNemPdfUsaOLink() {
        assertThat(SubmissionService.displayTitle(null, null, "https://doi.org/10.1/abc")).isEqualTo("https://doi.org/10.1/abc");
    }

    @Test void buscaIgnoraAcentoEMaiusculas() {
        assertThat(SubmissionService.fold("  Miíase OFTALMOMIÍASE Ação ")).isEqualTo("miiase oftalmomiiase acao");
    }

    @Test void nadaInformadoViraSemTitulo() {
        assertThat(SubmissionService.displayTitle(null, ".pdf", null)).isEqualTo("Sem título");
    }
}
