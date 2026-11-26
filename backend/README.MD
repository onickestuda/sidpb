# README Backend

## Contexto da aplicação

Este backend pertence a uma plataforma web para visualização da distribuição de doenças parasitárias no Brasil.

A V1 da aplicação é focada na distribuição da miíase primária causada por *Cochliomyia hominivorax*. Os dados vêm de artigos científicos, monografias, dissertações e teses usados como referência no artigo de revisão “A review on the occurrence of Cochliomyia hominivorax (Diptera: Calliphoridae) in Brazil”, do prof. dr. Lívio Costa (UFMA).

O sistema possui:

- frontend web em React;
- backend em Spring Boot;
- banco PostgreSQL/PostGIS;
- pipeline externo que extrai dados de PDFs e envia JSON ao backend.

## Requisitos

- Java 21 ou superior
- PostGIS 15.3.4

## Execução da Aplicação

Antes de executar a aplicação, verifique se você possui:

* Docker e docker compose instalados
* arquivo .env
* arquivos da base geográfica do IBGE disponíveis

*Subir banco e API*

Para iniciar o banco de dados e a API:

`docker compose up -d db api`

*Executar carga da base geográfica IBGE*

A carga da base geográfica deve ser executada somente quando o banco ainda não possuir os dados de regiões, estados e municípios.

`docker compose --profile base_geografica run --rm base_geografica`

*Atenção*

Não execute a carga base_geografica em um banco que já possui os dados geográficos carregados, a menos que você esteja recriando ou atualizando intencionalmente a base IBGE.

A carga geográfica é um processo auxiliar e não precisa ser executada toda vez que a aplicação sobe.