BEGIN;
-- regiao
WITH regioes_tratadas AS (
    SELECT
        cd_regiao::INTEGER AS id_regiao,
        sigla_rg::VARCHAR(2) AS sigla,
        nm_regiao::VARCHAR(100) AS nome,
        ST_Multi(
            ST_CollectionExtract(
                ST_MakeValid(geom),
                3
            )
        )::geometry(MultiPolygon, 4674) AS geometria,
        area_km2::NUMERIC(15, 3) AS area_km2
    FROM stg_ibge_regioes
),
regioes_com_ponto AS (
    SELECT
        id_regiao,
        sigla,
        nome,
        ROUND(ST_Y(ST_PointOnSurface(geometria))::NUMERIC, 7) AS latitude_regiao,
        ROUND(ST_X(ST_PointOnSurface(geometria))::NUMERIC, 7) AS longitude_regiao,
        geometria,
        area_km2
    FROM regioes_tratadas
)
INSERT INTO regiao (
    id_regiao,
    sigla,
    nome,
    latitude_regiao,
    longitude_regiao,
    geometria,
    area_km2
)
SELECT
    id_regiao,
    sigla,
    nome,
    latitude_regiao,
    longitude_regiao,
    geometria,
    area_km2
FROM regioes_com_ponto
ON CONFLICT (id_regiao) DO UPDATE SET
    sigla = EXCLUDED.sigla,
    nome = EXCLUDED.nome,
    latitude_regiao = EXCLUDED.latitude_regiao,
    longitude_regiao = EXCLUDED.longitude_regiao,
    geometria = EXCLUDED.geometria,
    area_km2 = EXCLUDED.area_km2;

-- estado
WITH estados_tratados AS (
    SELECT
        cd_uf::INTEGER AS id_estado,
        sigla_uf::VARCHAR(2) AS sigla,
        nm_uf::VARCHAR(100) AS nome,
        FLOOR(cd_uf::NUMERIC / 10)::INTEGER AS id_regiao,
        ST_Multi(
            ST_CollectionExtract(
                ST_MakeValid(geom),
                3
            )
        )::geometry(MultiPolygon, 4674) AS geometria,
        area_km2::NUMERIC(15, 3) AS area_km2
    FROM stg_ibge_estados
),
estados_com_ponto AS (
    SELECT
        id_estado,
        sigla,
        nome,
        ROUND(ST_Y(ST_PointOnSurface(geometria))::NUMERIC, 7) AS latitude_estado,
        ROUND(ST_X(ST_PointOnSurface(geometria))::NUMERIC, 7) AS longitude_estado,
        geometria,
        area_km2,
        id_regiao
    FROM estados_tratados
)
INSERT INTO estado (
    id_estado,
    sigla,
    nome,
    latitude_estado,
    longitude_estado,
    geometria,
    area_km2,
    id_regiao
)
SELECT
    id_estado,
    sigla,
    nome,
    latitude_estado,
    longitude_estado,
    geometria,
    area_km2,
    id_regiao
FROM estados_com_ponto
ON CONFLICT (id_estado) DO UPDATE SET
    sigla = EXCLUDED.sigla,
    nome = EXCLUDED.nome,
    latitude_estado = EXCLUDED.latitude_estado,
    longitude_estado = EXCLUDED.longitude_estado,
    geometria = EXCLUDED.geometria,
    area_km2 = EXCLUDED.area_km2,
    id_regiao = EXCLUDED.id_regiao;

-- municipio
WITH municipios_tratados AS (
    SELECT
        cd_mun::INTEGER AS id_municipio,
        nm_mun::VARCHAR(150) AS nome,
        SUBSTRING(cd_mun::TEXT FROM 1 FOR 2)::INTEGER AS id_estado,
        ST_Multi(
            ST_CollectionExtract(
                ST_MakeValid(geom),
                3
            )
        )::geometry(MultiPolygon, 4674) AS geometria,
        area_km2::NUMERIC(15, 3) AS area_km2
    FROM stg_ibge_municipios
),
municipios_com_ponto AS (
    SELECT
        id_municipio,
        nome,
        ROUND(ST_Y(ST_PointOnSurface(geometria))::NUMERIC, 7) AS latitude_municipio,
        ROUND(ST_X(ST_PointOnSurface(geometria))::NUMERIC, 7) AS longitude_municipio,
        geometria,
        area_km2,
        id_estado
    FROM municipios_tratados
)
INSERT INTO municipio (
    id_municipio,
    nome,
    latitude_municipio,
    longitude_municipio,
    geometria,
    area_km2,
    id_estado
)
SELECT
    id_municipio,
    nome,
    latitude_municipio,
    longitude_municipio,
    geometria,
    area_km2,
    id_estado
FROM municipios_com_ponto
ON CONFLICT (id_municipio) DO UPDATE SET
    nome = EXCLUDED.nome,
    latitude_municipio = EXCLUDED.latitude_municipio,
    longitude_municipio = EXCLUDED.longitude_municipio,
    geometria = EXCLUDED.geometria,
    area_km2 = EXCLUDED.area_km2,
    id_estado = EXCLUDED.id_estado;

-- validações
DO $$
DECLARE
    total_regioes INTEGER;
    total_estados INTEGER;
    total_municipios INTEGER;
    geometrias_invalidas INTEGER;
    municipios_sem_estado INTEGER;
    estados_sem_regiao INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_regioes FROM regiao;
    SELECT COUNT(*) INTO total_estados FROM estado;
    SELECT COUNT(*) INTO total_municipios FROM municipio;

    IF total_regioes <> 5 THEN
        RAISE EXCEPTION 'Carga inválida: esperado 5 regiões, encontrado %.', total_regioes;
    END IF;

    IF total_estados <> 27 THEN
        RAISE EXCEPTION 'Carga inválida: esperado 27 estados/UFs, encontrado %.', total_estados;
    END IF;

    IF total_municipios < 5500 THEN
        RAISE EXCEPTION 'Carga inválida: esperado pelo menos 5500 municípios, encontrado %.', total_municipios;
    END IF;

    SELECT COUNT(*) INTO geometrias_invalidas
    FROM (
        SELECT geometria FROM regiao
        UNION ALL
        SELECT geometria FROM estado
        UNION ALL
        SELECT geometria FROM municipio
    ) AS geos
    WHERE geometria IS NULL
       OR ST_SRID(geometria) <> 4674
       OR NOT ST_IsValid(geometria);

    IF geometrias_invalidas > 0 THEN
        RAISE EXCEPTION 'Carga inválida: existem % geometrias nulas, inválidas ou com SRID diferente de 4674.', geometrias_invalidas;
    END IF;

    SELECT COUNT(*) INTO estados_sem_regiao
    FROM estado e
    LEFT JOIN regiao r ON r.id_regiao = e.id_regiao
    WHERE r.id_regiao IS NULL;

    IF estados_sem_regiao > 0 THEN
        RAISE EXCEPTION 'Carga inválida: existem % estados sem região válida.', estados_sem_regiao;
    END IF;

    SELECT COUNT(*) INTO municipios_sem_estado
    FROM municipio m
    LEFT JOIN estado e ON e.id_estado = m.id_estado
    WHERE e.id_estado IS NULL;

    IF municipios_sem_estado > 0 THEN
        RAISE EXCEPTION 'Carga inválida: existem % municípios sem estado válido.', municipios_sem_estado;
    END IF;

    RAISE NOTICE 'Carga validada: % regiões, % estados, % municípios.',
        total_regioes, total_estados, total_municipios;
END $$;

COMMIT;