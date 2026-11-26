# Submissão e curadoria de artigos

Implementação na branch `feature/article-submission-curation`, criada a partir de
`feature/authentication`: o `dev` local ainda não continha o login/V002. Não foi
feito merge nem alteração da branch `dev`.

## Modelo e decisões

O modelo existente usa `fonte` para título, autores JSONB, URL, data e identificação
da fonte. `ocorrencia` exige referências válidas a doença, parasito, hospedeiro e
local, além das relações taxonômicas. Essas são tabelas definitivas e não possuem
estado de submissão/revisão. Por isso, artigos ainda não conferidos ficam na área
de curadoria; nenhuma aprovação cria fonte, ocorrência ou registros geográficos.

Foi criada somente a tabela `submissao_artigo`, por meio da migration
`V003__CreateArticleSubmissions.sql`. V001 e V002 permanecem intactas.

| Colunas | Finalidade |
| --- | --- |
| `id_submissao`, `id_usuario` | Chave identity e FK para quem enviou |
| `titulo`, `link_original` | Título informado e URL original HTTP/HTTPS |
| `pdf_path`, `pdf_nome`, `pdf_tamanho` | Chave relativa, nome original e tamanho; conteúdo fora do banco |
| `status` | PENDING, APPROVED ou REJECTED |
| `ano`, `doenca` | Campos informados pelo usuário, em colunas para filtros |
| `dados_usuario` | JSONB original, preservado |
| `dados_llm` | JSONB separado da extração |
| `dados_curados` | JSONB final conferido pelo curador na aprovação |
| `extraction_status`, `extracted_at`, `extraction_model`, `extraction_mock` | Estado PENDING/COMPLETED/FAILED, data, utilitário e identificação do mock |
| `id_curador`, `reviewed_at`, `rejection_reason` | Responsável, data e motivo da decisão |
| `created_at`, `updated_at`, `version` | Datas e controle de concorrência |

Há índices por usuário/data, status/data, ano e doença. CHECKs validam status,
estrutura JSONB, tamanho do PDF e consistência da decisão. Não é necessário um
histórico separado: nesta fase cada submissão recebe uma única decisão, preservada
no registro. Uma segunda decisão retorna 409; `@Version` também evita sobrescrita
entre decisões simultâneas.

Os três conjuntos de dados têm o mesmo contrato: título, lista de autores, ano,
DOI, doença, parasito, vetor, hospedeiro, estado, município, latitude, longitude,
fonte e observações. Os nomes são livres nesta área de revisão, sem criar entradas
automáticas nos catálogos definitivos. Coordenadas são opcionais, mas devem ser
informadas em par. Título é obrigatório; os demais dados são opcionais.

## PDFs e Docker

- Limite de arquivo: **20 MB**. Limite total multipart: 25 MB.
- Valida extensão `.pdf`, MIME `application/pdf`, conteúdo não vazio e assinatura
  `%PDF-`. É uma verificação básica de formato, sem parser/leitor customizado.
- O serviço gera uma chave UUID com extensão `.pdf`; o nome recebido nunca define
  um caminho de escrita. `pdf_path` guarda somente essa chave relativa.
- No Docker, o volume `submissions_data` é montado em `/app/storage` na API. A
  configuração `SIDPB_SUBMISSIONS_STORAGE_DIR=/app/storage/submissions` aponta para
  uma localização interna estável, independente da máquina do desenvolvedor.
- Em execução local, o padrão é `./storage/submissions`, relativo ao diretório de
  execução. Ao executar dentro de `backend`, essa pasta está no `.gitignore`.
- O arquivo é removido se a transação de criação sofrer rollback, inclusive no commit.
- Downloads passam por endpoints de PDF com nome de resposta `artigo-{id}.pdf`,
  Content-Type `application/pdf` e Content-Disposition `inline`; DTOs JSON não
  expõem caminhos internos do storage ou credenciais dos usuários.
- A recriação do container da API preserva os PDFs no volume. A configuração de
  volume também foi acrescentada ao Compose existente de `backend`.
- `PdfStorageService` centraliza o filesystem. A futura integração com storage
  externo pode substituir esse serviço mantendo os endpoints e o frontend.

## Extração provisória

Não existia infraestrutura de LLM, parser de PDF ou pipeline de extração no projeto.
`DocumentExtractionService` define a fronteira de extração;
`MockDocumentExtractionService` é a implementação atual.

O mock não interpreta o PDF: devolve uma fixture de desenvolvimento com dados
fictícios, utilitário `sidpb-mock-v1`, `extractionMock=true` e status COMPLETED.
A tela de revisão identifica expressamente que os dados não foram extraídos do PDF.
Nada sobrescreve `dados_usuario`. Uma falha de extração mantém a submissão PENDING
e registra extração FAILED, permitindo revisão manual.

O mock é síncrono e rápido, sem fila/infraestrutura externa. Uma integração real
pode substituir a implementação; para processamento demorado, a etapa seguinte
deverá executar a extração fora da transação de upload e atualizar esses mesmos
campos de processamento. Não há API para cadastrar manualmente uma extração:
o mock já produz e persiste um resultado reproduzível em cada submissão.

## Endpoints

| Método/rota | Operação |
| --- | --- |
| POST `/api/submissions` | Criar submissão multipart; retorna 201 |
| GET `/api/submissions/user/{userId}` | Lista paginada do usuário |
| GET `/api/submissions/{id}?userId={userId}` | Detalhes no escopo do usuário informado |
| GET `/api/submissions/{id}/pdf?userId={userId}` | PDF no mesmo escopo |
| GET `/api/curation/submissions` | Fila/histórico paginado com filtros |
| GET `/api/curation/submissions/{id}` | Detalhes para revisão |
| GET `/api/curation/submissions/{id}/pdf` | PDF para revisão |
| POST `/api/curation/submissions/{id}/approve` | Registrar aprovação e dados curados |
| POST `/api/curation/submissions/{id}/reject` | Registrar reprovação com motivo obrigatório |

Paginação: `page` começa em zero; `size` tem padrão 20 e limite 100. O frontend
utiliza 10 registros por página. Ordem: envio mais recente, com ID para desempate.
A fila aceita `status` (padrão PENDING), `title`, `year`, `disease`, `from` e `to`.
Busca por título/doença ignora maiúsculas e trata `%`/`_` como texto.
As datas `YYYY-MM-DD` são inclusivas e usam `America/Sao_Paulo`, assim como a UI.
Os filtros de ano/doença referem-se aos dados originalmente enviados.

As respostas de lista são estáveis, sem serializar a estrutura interna do Page JPA:

```json
{"items":[],"page":0,"size":10,"totalElements":0,"totalPages":0}
```

Cada item inclui `id`, `title`, `originalLink`, `status`, `createdAt`,
`submittedBy`, `reviewedBy` e `reviewedAt`. Pessoas incluem somente `{id,name}`.
Detalhes acrescentam `pdfName`, `pdfSize`, `updatedAt`, `userData`, `llmData`,
`curatedData`, os metadados da extração e `rejectionReason`.

### Criação multipart

Duas partes obrigatórias: `pdf` (arquivo) e `data` (JSON com Content-Type
`application/json`). Exemplo da parte `data`:

```json
{
  "userId": 3,
  "originalLink": "https://doi.org/10.1234/exemplo",
  "userData": {
    "title": "Artigo científico",
    "authors": ["Autora A", "Autor B"],
    "year": 2024,
    "disease": "Leishmaniose",
    "municipality": "São Luís"
  }
}
```

Campos opcionais podem ser omitidos ou nulos. Os IDs dos usuários são obtidos do
login, não devem ser assumidos como fixos pelo cliente. O serviço frontend usa
FormData e um Blob JSON; `apiClient.ts` foi estendido para enviar FormData sem
definir manualmente Content-Type/boundary, preservando suas chamadas JSON.

### Aprovação e reprovação

```json
{"curatorId":2,"curatedData":{"title":"Título conferido","authors":["Autora A"],"year":2024}}
```

```json
{"curatorId":2,"reason":"Dados insuficientes para validar a ocorrência."}
```

Aprovação registra APPROVED, curador, data e snapshot `dados_curados`. Os dados
originais e a extração permanecem intactos. A reprovação registra REJECTED, curador,
data e motivo aparado. Ambos retornam o detalhe atualizado.

Erros usam `{"message":"..."}`: 400 para entradas inválidas, 404 para submissão/PDF
ausente ou fora do usuário informado, 409 para decisão já registrada/conflito de
versão, 413 para upload acima do limite e 500 para falha interna sem detalhes na
resposta. O tratamento é restrito aos controllers novos; o handler de tamanho
multipart é global porque o upload é processado antes de selecionar o controller.

## Frontend

- `/usuario`: formulário de envio seguido de **Minhas submissões**, com data,
  status distinto e paginação. Após enviar, o formulário limpa os campos, volta à
  primeira página da lista e oferece um link para consultar o registro.
- `/usuario/submissoes/{id}`: dados enviados, link original, PDF, status e resultado
  final da decisão; não permite edição ou decisão.
- `/curador`: fila com abas **Pendentes**, **Aprovados** e **Reprovados**, filtros
  por título, ano, doença e período de envio, paginação e botão de atualização.
- `/curador/submissoes/{id}`: fonte/PDF, identificação do envio, comparação lado a
  lado dos dados USER/LLM com diferenças destacadas. Em telas pequenas, as colunas
  viram seções verticais.
- O curador expande **Conferir e ajustar dados para aprovação** para revisar os
  campos, inicialmente preenchidos pelos dados do usuário. O mock nunca é adotado
  silenciosamente como resultado final.
- Aprovar/reprovar abre confirmação; cancelar não envia decisão. Reprovação exige
  motivo. Após sucesso, retorna à fila; registros decididos mostram o resultado
  e não oferecem novas ações.
- O histórico exibe fonte, quem enviou, quem decidiu e data; o detalhe preserva PDF,
  dados originais, extração e decisão.
- Componentes existentes de card, tabela, badge, tabs, alert-dialog, input e textarea
  foram reutilizados. Os formulários usam React Hook Form já instalado; consultas
  e mutações usam React Query. Não foram adicionadas dependências.
- O Zustand continua sendo usado somente para o usuário provisório. Novas consultas
  incluem o ID do usuário na chave quando necessário. Logout limpa o estado e os
  caches de submissão/curadoria. As listas são atualizadas ao voltar/focar a tela.
- `Link` e router usam rotas sem concatenar `/sidpb`; o Next aplica o basePath.

## Autenticação provisória e substituições futuras

Os guards existentes foram reutilizados: USER acessa suas telas; CURATOR, as telas
de curadoria. ADMIN continua no painel existente e não ganha acesso automático.
Dashboard, login, CORS e endpoints públicos permanecem como estavam.

`userId` e `curatorId` ainda são fornecidos pelo frontend e podem ser forjados. A
consulta com `userId` restringe os dados funcionalmente, mas não é autorização real.
O backend verifica a existência das referências; não implementa autorização por
role, sessão, Spring Security, JWT, cookie HttpOnly, CSRF ou refresh token.

Quando a autenticação real for implementada, derive os atores da identidade
autenticada no servidor, proteja submissões/decisões/PDFs e substitua os guards.
Quando a LLM real existir, substitua o mock e valide o resultado antes de publicar.
A publicação exigirá mapear os dados curados para `fonte`, `ocorrencia` e suas FKs
taxonômicas/geográficas; essa transformação não é feita nesta fase.

## Como testar

A aplicação atualizada está em `http://localhost:7080/sidpb/`.

1. Entre com `usuario@sidpb.local` / `usuario123`.
2. Selecione um PDF real, informe link original e título; preencha os opcionais.
3. Envie e confira Pendente em Minhas submissões. Abra para consultar PDF e dados.
4. Saia e entre com `curador@sidpb.local` / `curador123`.
5. Abra o artigo na fila, consulte PDF/fonte e compare os dados com a extração mock.
6. Ajuste os dados para aprovação, aprove e confirme. Confira a aba Aprovados.
7. Repita com outro envio; reprove com motivo e confirme. Confira Reprovados.
8. Volte como USER e consulte os resultados. Sem login, o botão Acessar o mapa
   continua abrindo o dashboard público.

Existem três fixtures deixadas pela validação no banco de desenvolvimento, IDs
1, 2 e 3: uma aprovada (com título curado), uma reprovada (com motivo) e uma pendente.
Seus PDFs têm uma página de texto de teste e o link original aponta para
`example.org`; são exemplos de fluxo, não artigos científicos reais.

Para reconstruir a aplicação usando o Dockerfile existente da API, gere o JAR antes:

```powershell
cd backend
.\mvnw.cmd package -DskipTests
cd ..
docker compose up -d --build api frontend
```

Para os testes automatizados, use uma base PostgreSQL/PostGIS dedicada. Nesta
máquina o PostgreSQL do Windows usa 5432; o teste foi executado em 55432:

```powershell
docker run --detach --name sidpb_submissions_test_db --publish 127.0.0.1:55432:5432 --env POSTGRES_USER=postgres --env POSTGRES_PASSWORD=postgres --env POSTGRES_DB=parasitologia_test postgis/postgis:15-3.4-alpine
# Aguarde pg_isready indicar que o banco está pronto.
cd backend
$env:TEST_DB_URL = 'jdbc:postgresql://127.0.0.1:55432/parasitologia_test'
.\mvnw.cmd package
cd ../frontend
npx tsc --noEmit --incremental false
npm run build
cd ..
docker rm --force sidpb_submissions_test_db
```

## Arquivos

Criados no backend, sob `backend/src/main/java/com/nca/sistema_miiase_app/`:

- `controller/SubmissionController.java`
- `controller/CurationController.java`
- `controller/SubmissionExceptionHandler.java`
- `controller/MultipartExceptionHandler.java`
- `domain/entity/SubmissaoArtigo.java`
- `domain/entity/SubmissaoStatus.java`
- `domain/entity/ExtractionStatus.java`
- `domain/repository/SubmissaoArtigoRepository.java`
- `dto/submission/ArticleDataDto.java`
- `dto/submission/SubmissionRequestDto.java`
- `dto/submission/SubmissionSummaryDto.java`
- `dto/submission/SubmissionDetailDto.java`
- `dto/submission/SubmissionPageDto.java`
- `dto/submission/PersonDto.java`
- `dto/curation/ApproveRequestDto.java`
- `dto/curation/RejectRequestDto.java`
- `service/submission/SubmissionService.java`
- `service/submission/PdfStorageService.java`
- `service/curation/CurationService.java`
- `service/extraction/DocumentExtractionService.java`
- `service/extraction/MockDocumentExtractionService.java`

Migration: `backend/src/main/resources/db/migration/V003__CreateArticleSubmissions.sql`.

Testes criados sob `backend/src/test/java/com/nca/sistema_miiase_app/`:

- `controller/SubmissionControllersTest.java`
- `service/submission/PdfStorageServiceTest.java`
- `service/submission/SubmissionFlowIntegrationTest.java`

Criados no frontend, sob `frontend/src/`:

- `entities/submission/submission.types.ts`
- `modules/auth/components/ProfileLayout.tsx`
- `modules/submissions/services/submissions.service.ts`
- `modules/submissions/components/ArticleFields.tsx`
- `modules/submissions/components/ArticleDataView.tsx`
- `modules/submissions/components/SubmissionForm.tsx`
- `modules/submissions/components/UserSubmissions.tsx`
- `modules/submissions/components/UserSubmissionDetail.tsx`
- `modules/submissions/components/SubmissionOverview.tsx`
- `modules/submissions/components/SubmissionStatusBadge.tsx`
- `modules/submissions/components/SubmissionTable.tsx`
- `modules/curation/services/curation.service.ts`
- `modules/curation/components/CurationQueue.tsx`
- `modules/curation/components/CurationReview.tsx`
- `app/usuario/submissoes/[id]/page.tsx`
- `app/curador/submissoes/[id]/page.tsx`

Também criado: este `docs/curadoria-e-submissoes.md`.

Modificados:

- `backend/.gitignore` (storage local)
- (removido) `backend/docker-compose.yaml`
- `backend/src/main/resources/application.properties` (storage e limites multipart)
- `docker-compose.yaml` (volume de PDFs)
- `frontend/src/app/usuario/page.tsx` (submissões)
- `frontend/src/app/curador/page.tsx` (fila)
- `frontend/src/lib/apiClient.ts` (FormData)

## Validação executada

- Backend: **85 testes, zero falhas/erros**; 28 novos (13 de integração, 6 de storage,
  9 de controllers), além dos 57 existentes. Os testes de integração usam
  PostgreSQL/PostGIS com Flyway e storage temporário real.
- TypeScript separado: passou. Build Next: passou, incluindo as duas rotas dinâmicas.
- Flyway da aplicação: V001/V002/V003 aplicadas. Os três registros de demonstração
  foram confirmados no PostgreSQL com status, dados e metadados de decisão.
- Chrome headless/Playwright já disponível no cache local, sem dependências novas:
  upload multipart real de três PDFs, lista USER, detalhes, comparação USER/LLM,
  ajuste do snapshot curado, confirmação/cancelamento, aprovação/reprovação,
  motivo obrigatório, históricos, consulta das decisões pelo usuário e logout.
- Respostas reais: PDF retornou bytes idênticos aos enviados; arquivo de 21 MB
  retornou 413 com mensagem amigável; segunda decisão retornou 409; consulta com
  outro ID de usuário retornou 404.
- O login ADMIN continuou funcionando sem acesso automático à curadoria; guard
  anônimo do detalhe e dashboard/mapa público com API HTTP 200 também passaram.
- PDFs e dados foram preservados após recriar o container da API.

O container de banco de testes foi removido ao final. API, frontend e banco da
aplicação permanecem em execução. Scripts/snapshots transitórios de navegador
ficaram em `backend/target`, ignorado pelo Git; não foi criada infraestrutura nova
de testes frontend.
