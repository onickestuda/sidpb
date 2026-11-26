BEGIN;

CREATE TEMP TABLE seed_miiase_previous_locais (
    id_local INTEGER PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO seed_miiase_previous_locais (id_local)
SELECT DISTINCT o.id_local
FROM ocorrencia o
JOIN ocorrencia_fonte ofn ON ofn.id_ocorrencia = o.id_ocorrencia
JOIN fonte f ON f.id_fonte = ofn.id_fonte
WHERE f.nome_fonte LIKE 'SIDPB_TEST_MIIASE:%'
   OR f.titulo LIKE 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB%';

DELETE FROM ocorrencia o
WHERE EXISTS (
    SELECT 1
    FROM ocorrencia_fonte ofn
    JOIN fonte f ON f.id_fonte = ofn.id_fonte
    WHERE ofn.id_ocorrencia = o.id_ocorrencia
      AND (
          f.nome_fonte LIKE 'SIDPB_TEST_MIIASE:%'
          OR f.titulo LIKE 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB%'
      )
);

DELETE FROM local l
USING seed_miiase_previous_locais pl
WHERE l.id_local = pl.id_local
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia o
      WHERE o.id_local = l.id_local
  );

DELETE FROM fonte f
WHERE (
        f.nome_fonte LIKE 'SIDPB_TEST_MIIASE:%'
        OR f.titulo LIKE 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB%'
    )
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia_fonte ofn
      WHERE ofn.id_fonte = f.id_fonte
  );

CREATE TEMP TABLE seed_miiase_hospedeiros (
    nome_cientifico VARCHAR(200) PRIMARY KEY,
    nome_categoria VARCHAR(100) NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_miiase_hospedeiros (nome_cientifico, nome_categoria)
VALUES
    ('Homo sapiens', 'HUMANO'),
    ('Bos taurus', 'ANIMAL_PRODUCAO'),
    ('Capra hircus', 'ANIMAL_PRODUCAO'),
    ('Ovis aries', 'ANIMAL_PRODUCAO'),
    ('Canis lupus familiaris', 'ANIMAL_COMPANHIA'),
    ('Equus caballus', 'ANIMAL_PRODUCAO');

INSERT INTO categoria_hospedeiro (nome_categoria)
SELECT DISTINCT nome_categoria
FROM seed_miiase_hospedeiros
ON CONFLICT (nome_categoria) DO NOTHING;

INSERT INTO hospedeiro (nome_cientifico, id_categoria)
SELECT sh.nome_cientifico, ch.id_categoria
FROM seed_miiase_hospedeiros sh
JOIN categoria_hospedeiro ch ON ch.nome_categoria = sh.nome_categoria
ON CONFLICT (nome_cientifico) DO NOTHING;

INSERT INTO doenca (nome_cientifico, sinonimos)
VALUES (U&'Mi\00EDase', jsonb_build_array(U&'mi\00EDase', 'myiasis', 'miiase'))
ON CONFLICT (nome_cientifico) DO NOTHING;

CREATE TEMP TABLE seed_miiase_parasitos (
    nome_cientifico VARCHAR(200) PRIMARY KEY,
    ordem_taxonomica VARCHAR(100)
) ON COMMIT DROP;

INSERT INTO seed_miiase_parasitos (nome_cientifico, ordem_taxonomica)
VALUES
    ('Cochliomyia hominivorax', 'Diptera'),
    ('Dermatobia hominis', 'Diptera'),
    ('Oestrus ovis', 'Diptera');

INSERT INTO parasito (nome_cientifico, ordem_taxonomica)
SELECT nome_cientifico, ordem_taxonomica
FROM seed_miiase_parasitos
ON CONFLICT (nome_cientifico) DO NOTHING;

CREATE TEMP TABLE seed_miiase_vetores (
    nome_cientifico VARCHAR(200) PRIMARY KEY,
    sinonimos JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_miiase_vetores (nome_cientifico, sinonimos)
VALUES
    ('Cochliomyia hominivorax', jsonb_build_array('mosca-da-bicheira')),
    ('Dermatobia hominis', jsonb_build_array('mosca-berneira')),
    ('Oestrus ovis', jsonb_build_array('mosca-nasal-ovina'));

INSERT INTO vetor (nome_cientifico, sinonimos)
SELECT nome_cientifico, sinonimos
FROM seed_miiase_vetores
ON CONFLICT (nome_cientifico) DO NOTHING;

INSERT INTO doenca_parasito (id_doenca, id_parasito)
SELECT d.id_doenca, p.id_parasito
FROM doenca d
JOIN parasito p ON p.nome_cientifico IN (
    'Cochliomyia hominivorax',
    'Dermatobia hominis',
    'Oestrus ovis'
)
WHERE d.nome_cientifico = U&'Mi\00EDase'
ON CONFLICT (id_doenca, id_parasito) DO NOTHING;

INSERT INTO vetor_parasito (id_vetor, id_parasito)
SELECT v.id_vetor, p.id_parasito
FROM vetor v
JOIN parasito p ON p.nome_cientifico = v.nome_cientifico
WHERE v.nome_cientifico IN (
    'Cochliomyia hominivorax',
    'Dermatobia hominis',
    'Oestrus ovis'
)
ON CONFLICT (id_vetor, id_parasito) DO NOTHING;

CREATE TEMP TABLE seed_miiase_fontes (
    fonte_key VARCHAR(10) PRIMARY KEY,
    nome_fonte VARCHAR(200) NOT NULL,
    tipo_fonte VARCHAR(100) NOT NULL,
    titulo VARCHAR(500) NOT NULL,
    autores JSONB NOT NULL,
    url VARCHAR(1000),
    data DATE
) ON COMMIT DROP;

INSERT INTO seed_miiase_fontes (fonte_key, nome_fonte, tipo_fonte, titulo, autores, url, data)
VALUES
    ('F001', 'SIDPB_TEST_MIIASE:F001', 'artigo', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Myiasis Nordeste 2017', jsonb_build_array('Equipe Ficticia SIDPB'), 'https://example.test/sidpb/miiase/f001', DATE '2017-04-12'),
    ('F002', 'SIDPB_TEST_MIIASE:F002', 'artigo', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Myiasis Amazonia 2018', jsonb_build_array('Laboratorio Ficticio Norte'), 'https://example.test/sidpb/miiase/f002', DATE '2018-08-20'),
    ('F003', 'SIDPB_TEST_MIIASE:F003', 'relatorio', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Relatorio pecuario Centro-Oeste', jsonb_build_array('Servico Veterinario Ficticio'), 'https://example.test/sidpb/miiase/f003', DATE '2019-11-05'),
    ('F004', 'SIDPB_TEST_MIIASE:F004', 'tese', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Serie clinica Sudeste', jsonb_build_array('Programa Ficticio de Pos-Graduacao'), 'https://example.test/sidpb/miiase/f004', DATE '2020-02-14'),
    ('F005', 'SIDPB_TEST_MIIASE:F005', 'dissertacao', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Hospedeiros domesticos Sul', jsonb_build_array('Grupo Ficticio de Parasitologia'), 'https://example.test/sidpb/miiase/f005', DATE '2021-09-30'),
    ('F006', 'SIDPB_TEST_MIIASE:F006', 'monografia', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Ocorrencias urbanas simuladas', jsonb_build_array('Nucleo Academico Ficticio'), 'https://example.test/sidpb/miiase/f006', DATE '2022-06-18'),
    ('F007', 'SIDPB_TEST_MIIASE:F007', 'artigo', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Comparacao de agentes ficticios', jsonb_build_array('Consorcio Ficticio SIDPB'), 'https://example.test/sidpb/miiase/f007', DATE '2023-03-09'),
    ('F008', 'SIDPB_TEST_MIIASE:F008', 'relatorio', 'DADO FICTICIO PARA TESTE DE INTEGRACAO DO SIDPB - Validacao de filtros e mapa', jsonb_build_array('Equipe QA SIDPB'), 'https://example.test/sidpb/miiase/f008', DATE '2024-12-01');

INSERT INTO fonte (nome_fonte, tipo_fonte, titulo, autores, url, data)
SELECT nome_fonte, tipo_fonte, titulo, autores, url, data
FROM seed_miiase_fontes;

CREATE TEMP TABLE seed_miiase_locais (
    local_key VARCHAR(10) PRIMARY KEY,
    id_municipio INTEGER NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    latitude_delta NUMERIC(10,7) NOT NULL,
    longitude_delta NUMERIC(10,7) NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_miiase_locais (local_key, id_municipio, bairro, latitude_delta, longitude_delta)
VALUES
    ('L001', 2304400, 'SIDPB_TEST_MIIASE - Centro 01', 0.0010000, -0.0010000),
    ('L002', 2304400, 'SIDPB_TEST_MIIASE - Aldeota 02', 0.0030000, 0.0040000),
    ('L003', 2304400, 'SIDPB_TEST_MIIASE - Messejana 03', -0.0040000, 0.0020000),
    ('L004', 2307304, 'SIDPB_TEST_MIIASE - Centro 04', 0.0020000, -0.0030000),
    ('L005', 2611606, 'SIDPB_TEST_MIIASE - Boa Viagem 05', 0.0020000, 0.0020000),
    ('L006', 2611606, 'SIDPB_TEST_MIIASE - Casa Forte 06', -0.0030000, -0.0020000),
    ('L007', 2611101, 'SIDPB_TEST_MIIASE - Centro 07', 0.0030000, 0.0010000),
    ('L008', 2927408, 'SIDPB_TEST_MIIASE - Barra 08', 0.0020000, -0.0020000),
    ('L009', 2927408, 'SIDPB_TEST_MIIASE - Cabula 09', -0.0020000, 0.0030000),
    ('L010', 2910800, 'SIDPB_TEST_MIIASE - Centro 10', 0.0040000, -0.0030000),
    ('L011', 2111300, 'SIDPB_TEST_MIIASE - Centro 11', 0.0020000, -0.0010000),
    ('L012', 2111300, 'SIDPB_TEST_MIIASE - Renascenca 12', -0.0030000, 0.0020000),
    ('L013', 2105302, 'SIDPB_TEST_MIIASE - Centro 13', 0.0020000, 0.0030000),
    ('L014', 1501402, 'SIDPB_TEST_MIIASE - Umarizal 14', 0.0020000, -0.0020000),
    ('L015', 1501402, 'SIDPB_TEST_MIIASE - Icoaraci 15', -0.0030000, 0.0020000),
    ('L016', 1506807, 'SIDPB_TEST_MIIASE - Centro 16', 0.0030000, -0.0010000),
    ('L017', 1302603, 'SIDPB_TEST_MIIASE - Centro 17', 0.0020000, 0.0010000),
    ('L018', 1302603, 'SIDPB_TEST_MIIASE - Aleixo 18', -0.0020000, -0.0030000),
    ('L019', 1302603, 'SIDPB_TEST_MIIASE - Ponta Negra 19', 0.0040000, 0.0030000),
    ('L020', 1303403, 'SIDPB_TEST_MIIASE - Centro 20', -0.0020000, 0.0020000),
    ('L021', 5208707, 'SIDPB_TEST_MIIASE - Setor Bueno 21', 0.0020000, -0.0020000),
    ('L022', 5208707, 'SIDPB_TEST_MIIASE - Campinas 22', -0.0030000, 0.0030000),
    ('L023', 5201108, 'SIDPB_TEST_MIIASE - Centro 23', 0.0030000, 0.0010000),
    ('L024', 3106200, 'SIDPB_TEST_MIIASE - Pampulha 24', 0.0030000, -0.0020000),
    ('L025', 3106200, 'SIDPB_TEST_MIIASE - Barreiro 25', -0.0040000, 0.0020000),
    ('L026', 3170206, 'SIDPB_TEST_MIIASE - Centro 26', 0.0030000, 0.0030000),
    ('L027', 3550308, 'SIDPB_TEST_MIIASE - Pinheiros 27', 0.0020000, -0.0020000),
    ('L028', 3550308, 'SIDPB_TEST_MIIASE - Tatuape 28', -0.0030000, 0.0020000),
    ('L029', 3550308, 'SIDPB_TEST_MIIASE - Santo Amaro 29', 0.0040000, 0.0040000),
    ('L030', 3509502, 'SIDPB_TEST_MIIASE - Cambui 30', -0.0030000, 0.0030000),
    ('L031', 3304557, 'SIDPB_TEST_MIIASE - Copacabana 31', 0.0020000, -0.0030000),
    ('L032', 3304557, 'SIDPB_TEST_MIIASE - Campo Grande 32', -0.0030000, 0.0020000),
    ('L033', 3304557, 'SIDPB_TEST_MIIASE - Centro 33', 0.0040000, 0.0040000),
    ('L034', 3303302, 'SIDPB_TEST_MIIASE - Icarai 34', -0.0020000, -0.0020000),
    ('L035', 4106902, 'SIDPB_TEST_MIIASE - Centro 35', 0.0020000, 0.0020000),
    ('L036', 4106902, 'SIDPB_TEST_MIIASE - Boqueirao 36', -0.0030000, -0.0020000),
    ('L037', 4113700, 'SIDPB_TEST_MIIASE - Centro 37', 0.0030000, -0.0030000),
    ('L038', 4314902, 'SIDPB_TEST_MIIASE - Centro 38', 0.0030000, 0.0020000),
    ('L039', 4314902, 'SIDPB_TEST_MIIASE - Partenon 39', -0.0020000, -0.0030000),
    ('L040', 4314407, 'SIDPB_TEST_MIIASE - Centro 40', 0.0020000, 0.0030000);

CREATE TEMP TABLE seed_miiase_local_values AS
SELECT
    sl.local_key,
    sl.id_municipio,
    sl.bairro,
    ROUND((m.latitude_municipio + sl.latitude_delta)::NUMERIC, 7) AS latitude_ocorrencia,
    ROUND((m.longitude_municipio + sl.longitude_delta)::NUMERIC, 7) AS longitude_ocorrencia
FROM seed_miiase_locais sl
JOIN municipio m ON m.id_municipio = sl.id_municipio;

DO $$
DECLARE
    locais_esperados INTEGER;
    locais_encontrados INTEGER;
BEGIN
    SELECT COUNT(*) INTO locais_esperados FROM seed_miiase_locais;
    SELECT COUNT(*) INTO locais_encontrados FROM seed_miiase_local_values;

    IF locais_esperados <> locais_encontrados THEN
        RAISE EXCEPTION 'Seed de miiase incompleta: esperado % locais, encontrado %. Verifique a base geografica IBGE.',
            locais_esperados,
            locais_encontrados;
    END IF;
END $$;

INSERT INTO local (bairro, latitude_ocorrencia, longitude_ocorrencia, id_municipio)
SELECT bairro, latitude_ocorrencia, longitude_ocorrencia, id_municipio
FROM seed_miiase_local_values;

CREATE TEMP TABLE seed_miiase_local_ids AS
SELECT slv.local_key, l.id_local
FROM seed_miiase_local_values slv
JOIN local l
  ON l.id_municipio = slv.id_municipio
 AND l.bairro = slv.bairro
 AND l.latitude_ocorrencia = slv.latitude_ocorrencia
 AND l.longitude_ocorrencia = slv.longitude_ocorrencia;

CREATE TEMP TABLE seed_miiase_ocorrencias (
    ocorrencia_key VARCHAR(10) PRIMARY KEY,
    local_key VARCHAR(10) NOT NULL,
    data DATE NOT NULL,
    parte_corpo VARCHAR(255),
    tratamento VARCHAR(255),
    desfecho VARCHAR(300),
    idade_hospedeiro VARCHAR(50),
    sexo_hospedeiro VARCHAR(30),
    estagio_vida_parasito VARCHAR(100),
    hospedeiro_nome VARCHAR(200) NOT NULL,
    parasito_nome VARCHAR(200) NOT NULL,
    vetor_nome VARCHAR(200)
) ON COMMIT DROP;

INSERT INTO seed_miiase_ocorrencias (
    ocorrencia_key, local_key, data, parte_corpo, tratamento, desfecho,
    idade_hospedeiro, sexo_hospedeiro, estagio_vida_parasito,
    hospedeiro_nome, parasito_nome, vetor_nome
)
VALUES
    ('O001', 'L001', DATE '2016-02-11', 'membro inferior', 'remocao mecanica e curativo', 'cura clinica', '34 anos', 'F', 'larva L3', 'Homo sapiens', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O002', 'L002', DATE '2018-05-03', 'ferida cutanea', 'debridamento local', 'cura clinica', 'adulto', 'M', 'larva L2', 'Bos taurus', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O003', 'L003', DATE '2021-09-27', 'regiao cefalica', 'ivermectina', 'em acompanhamento', '7 anos', 'M', 'larva L3', 'Canis lupus familiaris', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O004', 'L004', DATE '2023-01-14', 'cavidade nasal', 'remocao mecanica', 'cura clinica', '2 anos', 'F', 'larva nao informada', 'Capra hircus', 'Oestrus ovis', 'Oestrus ovis'),
    ('O005', 'L005', DATE '2017-07-22', 'conduto auditivo', 'limpeza e curativo', 'cura clinica', '46 anos', 'M', 'larva L2', 'Homo sapiens', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O006', 'L006', DATE '2020-03-18', 'ferida cutanea', 'antibioticoterapia suporte', 'recuperacao parcial', '5 anos', 'F', 'larva L3', 'Canis lupus familiaris', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O007', 'L007', DATE '2025-08-09', 'regiao umbilical', 'ivermectina', 'cura clinica', 'bezerro', 'M', 'larva L3', 'Bos taurus', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O008', 'L008', DATE '2015-10-01', 'membro inferior', 'remocao mecanica', 'cura clinica', '29 anos', 'F', 'larva L3', 'Homo sapiens', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O009', 'L009', DATE '2019-12-13', 'dorso', 'limpeza e curativo', 'perda de seguimento', 'adulto', 'indeterminado', 'larva L2', 'Equus caballus', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O010', 'L010', DATE '2022-04-25', 'membro posterior', 'debridamento local', 'cura clinica', '3 anos', 'F', 'larva L3', 'Ovis aries', 'Oestrus ovis', 'Oestrus ovis'),
    ('O011', 'L011', DATE '2016-06-17', 'ferida cutanea', 'remocao mecanica e curativo', 'cura clinica', '51 anos', 'M', 'larva L3', 'Homo sapiens', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O012', 'L012', DATE '2021-02-06', 'regiao cefalica', 'ivermectina', 'cura clinica', 'adulto', 'F', 'larva L2', 'Bos taurus', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O013', 'L013', DATE '2024-11-19', 'membro anterior', 'debridamento local', 'em acompanhamento', '4 anos', 'M', 'larva L3', 'Equus caballus', 'Cochliomyia hominivorax', NULL),
    ('O014', 'L014', DATE '2018-01-29', 'cavidade nasal', 'remocao mecanica', 'cura clinica', '2 anos', 'F', 'larva nao informada', 'Ovis aries', 'Oestrus ovis', 'Oestrus ovis'),
    ('O015', 'L015', DATE '2020-07-08', 'ferida cutanea', 'limpeza e curativo', 'cura clinica', '39 anos', 'F', 'larva L3', 'Homo sapiens', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O016', 'L016', DATE '2023-05-16', 'dorso', 'ivermectina', 'recuperacao parcial', 'adulto', 'M', 'larva L2', 'Canis lupus familiaris', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O017', 'L017', DATE '2017-03-11', 'ferida cutanea', 'debridamento local', 'cura clinica', '62 anos', 'M', 'larva L3', 'Homo sapiens', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O018', 'L018', DATE '2019-06-30', 'regiao lombar', 'limpeza e curativo', 'perda de seguimento', 'adulto', 'F', 'larva L2', 'Bos taurus', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O019', 'L019', DATE '2022-10-21', 'regiao cefalica', 'remocao mecanica', 'cura clinica', '8 anos', 'F', 'larva L3', 'Canis lupus familiaris', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O020', 'L020', DATE '2024-02-02', 'cavidade nasal', 'ivermectina', 'cura clinica', '1 ano', 'M', 'larva L2', 'Capra hircus', 'Oestrus ovis', 'Oestrus ovis'),
    ('O021', 'L021', DATE '2018-09-04', 'regiao umbilical', 'limpeza e curativo', 'cura clinica', 'bezerro', 'F', 'larva L3', 'Bos taurus', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O022', 'L022', DATE '2020-12-15', 'membro posterior', 'debridamento local', 'abate sanitario ficticio', 'adulto', 'M', 'larva L3', 'Bos taurus', 'Cochliomyia hominivorax', NULL),
    ('O023', 'L023', DATE '2025-01-28', 'ferida cutanea', 'ivermectina', 'em acompanhamento', '6 anos', 'F', 'larva L2', 'Equus caballus', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O024', 'L024', DATE '2016-11-07', 'membro inferior', 'remocao mecanica', 'cura clinica', '43 anos', 'F', 'larva L3', 'Homo sapiens', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O025', 'L025', DATE '2021-07-12', 'ferida cutanea', 'antibioticoterapia suporte', 'recuperacao parcial', 'adulto', 'indeterminado', 'larva L3', 'Equus caballus', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O026', 'L026', DATE '2023-09-03', 'cavidade nasal', 'remocao mecanica', 'cura clinica', '2 anos', 'F', 'larva nao informada', 'Ovis aries', 'Oestrus ovis', 'Oestrus ovis'),
    ('O027', 'L027', DATE '2017-12-20', 'conduto auditivo', 'limpeza e curativo', 'cura clinica', '36 anos', 'M', 'larva L2', 'Homo sapiens', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O028', 'L028', DATE '2019-04-02', 'ferida cutanea', 'debridamento local', 'cura clinica', 'adulto', 'F', 'larva L3', 'Canis lupus familiaris', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O029', 'L029', DATE '2022-08-18', 'regiao cefalica', 'ivermectina', 'em acompanhamento', '55 anos', 'F', 'larva L3', 'Homo sapiens', 'Cochliomyia hominivorax', NULL),
    ('O030', 'L030', DATE '2026-05-06', 'dorso', 'remocao mecanica e curativo', 'cura clinica', 'adulto', 'M', 'larva L2', 'Bos taurus', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O031', 'L031', DATE '2015-05-23', 'membro inferior', 'remocao mecanica', 'cura clinica', '27 anos', 'F', 'larva L3', 'Homo sapiens', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O032', 'L032', DATE '2018-11-30', 'ferida cutanea', 'limpeza e curativo', 'cura clinica', 'adulto', 'M', 'larva L3', 'Equus caballus', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O033', 'L033', DATE '2021-01-19', 'regiao cefalica', 'debridamento local', 'recuperacao parcial', '44 anos', 'M', 'larva L2', 'Homo sapiens', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O034', 'L034', DATE '2024-06-11', 'conduto auditivo', 'sem informacao', 'perda de seguimento', '31 anos', 'F', 'larva nao informada', 'Homo sapiens', 'Dermatobia hominis', NULL),
    ('O035', 'L035', DATE '2016-08-15', 'membro posterior', 'ivermectina', 'cura clinica', 'adulto', 'F', 'larva L3', 'Ovis aries', 'Oestrus ovis', 'Oestrus ovis'),
    ('O036', 'L036', DATE '2020-05-24', 'ferida cutanea', 'debridamento local', 'cura clinica', 'adulto', 'M', 'larva L3', 'Bos taurus', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O037', 'L037', DATE '2022-12-05', 'dorso', 'limpeza e curativo', 'em acompanhamento', '5 anos', 'M', 'larva L2', 'Canis lupus familiaris', 'Dermatobia hominis', 'Dermatobia hominis'),
    ('O038', 'L038', DATE '2017-02-27', 'cavidade nasal', 'remocao mecanica', 'cura clinica', '2 anos', 'F', 'larva L2', 'Capra hircus', 'Oestrus ovis', 'Oestrus ovis'),
    ('O039', 'L039', DATE '2023-10-10', 'regiao umbilical', 'antibioticoterapia suporte', 'recuperacao parcial', 'cordeiro', 'M', 'larva L3', 'Ovis aries', 'Cochliomyia hominivorax', 'Cochliomyia hominivorax'),
    ('O040', 'L040', DATE '2025-04-17', 'ferida cutanea', 'ivermectina', 'cura clinica', '3 anos', 'F', 'larva L3', 'Capra hircus', 'Dermatobia hominis', 'Dermatobia hominis');

INSERT INTO ocorrencia (
    data,
    parte_corpo,
    tratamento,
    desfecho,
    idade_hospedeiro,
    sexo_hospedeiro,
    estagio_vida_parasito,
    id_hospedeiro,
    id_doenca,
    id_parasito,
    id_vetor,
    id_local
)
SELECT
    so.data,
    so.parte_corpo,
    so.tratamento,
    so.desfecho,
    so.idade_hospedeiro,
    so.sexo_hospedeiro,
    so.estagio_vida_parasito,
    h.id_hospedeiro,
    d.id_doenca,
    p.id_parasito,
    v.id_vetor,
    sli.id_local
FROM seed_miiase_ocorrencias so
JOIN seed_miiase_local_ids sli ON sli.local_key = so.local_key
JOIN hospedeiro h ON h.nome_cientifico = so.hospedeiro_nome
JOIN doenca d ON d.nome_cientifico = U&'Mi\00EDase'
JOIN parasito p ON p.nome_cientifico = so.parasito_nome
LEFT JOIN vetor v ON v.nome_cientifico = so.vetor_nome;

CREATE TEMP TABLE seed_miiase_ocorrencia_ids AS
SELECT so.ocorrencia_key, o.id_ocorrencia
FROM seed_miiase_ocorrencias so
JOIN seed_miiase_local_ids sli ON sli.local_key = so.local_key
JOIN hospedeiro h ON h.nome_cientifico = so.hospedeiro_nome
JOIN doenca d ON d.nome_cientifico = U&'Mi\00EDase'
JOIN parasito p ON p.nome_cientifico = so.parasito_nome
LEFT JOIN vetor v ON v.nome_cientifico = so.vetor_nome
JOIN ocorrencia o
  ON o.data = so.data
 AND o.id_local = sli.id_local
 AND o.id_hospedeiro = h.id_hospedeiro
 AND o.id_doenca = d.id_doenca
 AND o.id_parasito = p.id_parasito
 AND (
        (o.id_vetor IS NULL AND v.id_vetor IS NULL)
        OR o.id_vetor = v.id_vetor
     );

CREATE TEMP TABLE seed_miiase_ocorrencia_fontes (
    ocorrencia_key VARCHAR(10) NOT NULL,
    fonte_key VARCHAR(10) NOT NULL,
    PRIMARY KEY (ocorrencia_key, fonte_key)
) ON COMMIT DROP;

INSERT INTO seed_miiase_ocorrencia_fontes (ocorrencia_key, fonte_key)
VALUES
    ('O001', 'F001'), ('O001', 'F008'),
    ('O002', 'F001'),
    ('O003', 'F006'),
    ('O004', 'F001'), ('O004', 'F007'),
    ('O005', 'F001'),
    ('O006', 'F006'),
    ('O007', 'F007'), ('O007', 'F008'),
    ('O008', 'F001'),
    ('O009', 'F003'),
    ('O010', 'F007'),
    ('O011', 'F001'),
    ('O012', 'F007'),
    ('O013', 'F003'), ('O013', 'F008'),
    ('O014', 'F002'),
    ('O015', 'F002'),
    ('O016', 'F002'), ('O016', 'F007'),
    ('O017', 'F002'),
    ('O018', 'F002'),
    ('O019', 'F008'),
    ('O020', 'F002'),
    ('O021', 'F003'),
    ('O022', 'F003'), ('O022', 'F008'),
    ('O023', 'F003'),
    ('O024', 'F004'),
    ('O025', 'F004'),
    ('O026', 'F004'), ('O026', 'F007'),
    ('O027', 'F004'),
    ('O028', 'F006'),
    ('O029', 'F004'), ('O029', 'F008'),
    ('O030', 'F004'),
    ('O031', 'F004'),
    ('O032', 'F004'),
    ('O033', 'F004'),
    ('O034', 'F006'),
    ('O035', 'F005'),
    ('O036', 'F005'),
    ('O037', 'F005'),
    ('O038', 'F005'), ('O038', 'F007'),
    ('O039', 'F005'),
    ('O040', 'F005'), ('O040', 'F008');

CREATE TEMP TABLE seed_miiase_fonte_ids AS
SELECT sf.fonte_key, f.id_fonte
FROM seed_miiase_fontes sf
JOIN fonte f ON f.nome_fonte = sf.nome_fonte;

INSERT INTO ocorrencia_fonte (id_ocorrencia, id_fonte)
SELECT soi.id_ocorrencia, sfi.id_fonte
FROM seed_miiase_ocorrencia_fontes sof
JOIN seed_miiase_ocorrencia_ids soi ON soi.ocorrencia_key = sof.ocorrencia_key
JOIN seed_miiase_fonte_ids sfi ON sfi.fonte_key = sof.fonte_key
ON CONFLICT (id_ocorrencia, id_fonte) DO NOTHING;

DO $$
DECLARE
    total_ocorrencias INTEGER;
    total_locais INTEGER;
    total_fontes INTEGER;
    total_relacoes_fonte INTEGER;
    total_orfas INTEGER;
    total_geometrias_invalidas INTEGER;
BEGIN
    SELECT COUNT(DISTINCT o.id_ocorrencia)
      INTO total_ocorrencias
    FROM ocorrencia o
    JOIN ocorrencia_fonte ofn ON ofn.id_ocorrencia = o.id_ocorrencia
    JOIN fonte f ON f.id_fonte = ofn.id_fonte
    WHERE f.nome_fonte LIKE 'SIDPB_TEST_MIIASE:%';

    SELECT COUNT(*)
      INTO total_locais
    FROM local
    WHERE bairro LIKE 'SIDPB_TEST_MIIASE - %';

    SELECT COUNT(*)
      INTO total_fontes
    FROM fonte
    WHERE nome_fonte LIKE 'SIDPB_TEST_MIIASE:%';

    SELECT COUNT(*)
      INTO total_relacoes_fonte
    FROM ocorrencia_fonte ofn
    JOIN fonte f ON f.id_fonte = ofn.id_fonte
    WHERE f.nome_fonte LIKE 'SIDPB_TEST_MIIASE:%';

    SELECT COUNT(*)
      INTO total_orfas
    FROM ocorrencia o
    LEFT JOIN hospedeiro h ON h.id_hospedeiro = o.id_hospedeiro
    LEFT JOIN doenca d ON d.id_doenca = o.id_doenca
    LEFT JOIN parasito p ON p.id_parasito = o.id_parasito
    LEFT JOIN local l ON l.id_local = o.id_local
    WHERE h.id_hospedeiro IS NULL
       OR d.id_doenca IS NULL
       OR p.id_parasito IS NULL
       OR l.id_local IS NULL;

    SELECT COUNT(*)
      INTO total_geometrias_invalidas
    FROM (
        SELECT geometria FROM regiao
        UNION ALL
        SELECT geometria FROM estado
        UNION ALL
        SELECT geometria FROM municipio
    ) geos
    WHERE geometria IS NULL
       OR ST_SRID(geometria) <> 4674
       OR NOT ST_IsValid(geometria);

    IF total_ocorrencias <> 40 THEN
        RAISE EXCEPTION 'Seed de miiase invalida: esperado 40 ocorrencias, encontrado %.', total_ocorrencias;
    END IF;

    IF total_locais <> 40 THEN
        RAISE EXCEPTION 'Seed de miiase invalida: esperado 40 locais, encontrado %.', total_locais;
    END IF;

    IF total_fontes <> 8 THEN
        RAISE EXCEPTION 'Seed de miiase invalida: esperado 8 fontes, encontrado %.', total_fontes;
    END IF;

    IF total_relacoes_fonte < 40 THEN
        RAISE EXCEPTION 'Seed de miiase invalida: esperado ao menos 40 relacoes ocorrencia-fonte, encontrado %.', total_relacoes_fonte;
    END IF;

    IF total_orfas > 0 THEN
        RAISE EXCEPTION 'Seed de miiase invalida: existem % ocorrencias com relacionamento obrigatorio orfao.', total_orfas;
    END IF;

    IF total_geometrias_invalidas > 0 THEN
        RAISE EXCEPTION 'Seed de miiase invalida: existem % geometrias IBGE invalidas.', total_geometrias_invalidas;
    END IF;

    RAISE NOTICE 'Seed de miiase validada: % ocorrencias, % locais, % fontes, % relacoes ocorrencia-fonte.',
        total_ocorrencias,
        total_locais,
        total_fontes,
        total_relacoes_fonte;
END $$;

COMMIT;
