# Dados do banco

Arquivos usados para popular o PostgreSQL/PostGIS. Nada aqui é empacotado na API:
o schema é criado pelas migrations Flyway em `backend/src/main/resources/db/migration`.

## `ibge/` — base geográfica

Carrega regiões, unidades da federação e municípios (malha IBGE 2025) em tabelas de
staging e as transforma para o schema da aplicação (`sql/InsercaoBaseIbge.sql`).

Os shapefiles **não são versionados** (o de municípios passa de 300 MB). Baixe a
malha municipal 2025 do IBGE (https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais.html)
e extraia assim:

```
ibge/shapefiles_ibge/
├── BR_Regioes/BR_Regioes_2025.shp (+ .dbf .prj .shx .cpg)
├── BR_UF/BR_UF_2025.shp           (+ …)
└── BR_Municipios/BR_Municipios_2025.shp (+ …)
```

Os caminhos usados dentro do container estão no `.env` (`REGIOES_SHP`, `ESTADOS_SHP`,
`MUNICIPIOS_SHP`, `TRANSFORMACAO_STG_TO_DB`). Rode uma única vez, com o banco vazio:

```bash
docker compose --profile base_geografica run --rm base_geografica
```

Não rode em um banco que já tem a base geográfica, a menos que a intenção seja recriá-la.

## `seed/` — dados de teste

- `seed_miiase_test.sql`: ocorrências de miíase para desenvolvimento
  (`docker compose --profile seed run --rm seed_miiase`, depois que o Flyway criou o schema).
- `remove_miiase_test.sql`: remove esses dados de teste.
