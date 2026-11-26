package com.nca.sistema_miiase_app.config;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nca.sistema_miiase_app.service.extraction.ExtractionIngestionService;

/**
 * One-off batch load of a pipeline JSONL through the same ingestion used by POST /api/admin/extracoes.
 * Usage: --sidpb.import.jsonl=/data/file.jsonl [--sidpb.import.limit=1] --spring.main.web-application-type=none
 */
@Configuration
@ConditionalOnProperty("sidpb.import.jsonl")
public class ExtractionImportRunner implements ApplicationRunner {
    private final ExtractionIngestionService ingestion;
    private final Environment environment;
    private final ConfigurableApplicationContext context;

    public ExtractionImportRunner(ExtractionIngestionService ingestion, Environment environment, ConfigurableApplicationContext context) {
        this.ingestion = ingestion;
        this.environment = environment;
        this.context = context;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        Path file = Path.of(environment.getRequiredProperty("sidpb.import.jsonl"));
        int limit = environment.getProperty("sidpb.import.limit", Integer.class, Integer.MAX_VALUE);
        ObjectMapper json = new ObjectMapper();
        List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        int processed = 0, created = 0, failed = 0;
        System.out.println("[importacao] arquivo=" + file.getFileName() + " linhas=" + lines.size() + " limite=" + (limit == Integer.MAX_VALUE ? "todas" : limit));
        for (String line : lines) {
            if (line.isBlank()) continue;
            if (processed >= limit) break;
            processed++;
            try {
                JsonNode node = json.readTree(line);
                var outcome = ingestion.ingest(new ExtractionIngestionService.Payload(
                        node.path("id").asText(null), node.path("model").asText(null), node.get("sumarization")));
                if (outcome.created()) created++;
                System.out.println("[importacao] " + (outcome.created() ? "NOVA " : "JA_EXISTIA ") + "submissao=" + outcome.submissionId()
                        + " qualidade=" + outcome.quality() + " ocorrencias=" + outcome.occurrences() + " locais=" + outcome.byPrecision()
                        + " id=" + abbreviate(outcome.externalId()));
            } catch (Exception error) {
                failed++;
                System.out.println("[importacao] ERRO linha " + processed + ": " + error.getMessage());
            }
        }
        System.out.println("[importacao] fim: processadas=" + processed + " novas=" + created + " erros=" + failed);
        if (environment.getProperty("sidpb.import.exit", Boolean.class, true)) {
            System.exit(org.springframework.boot.SpringApplication.exit(context, () -> 0));
        }
    }

    private static String abbreviate(String value) {
        return value == null || value.length() <= 90 ? value : value.substring(0, 87) + "...";
    }
}
