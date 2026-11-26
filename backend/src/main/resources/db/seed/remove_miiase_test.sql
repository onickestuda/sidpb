BEGIN;

CREATE TEMP TABLE seed_miiase_locais_para_remover (
    id_local INTEGER PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO seed_miiase_locais_para_remover (id_local)
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
USING seed_miiase_locais_para_remover lr
WHERE l.id_local = lr.id_local
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

DELETE FROM vetor_parasito vp
USING vetor v, parasito p
WHERE vp.id_vetor = v.id_vetor
  AND vp.id_parasito = p.id_parasito
  AND v.nome_cientifico IN ('Cochliomyia hominivorax', 'Dermatobia hominis', 'Oestrus ovis')
  AND p.nome_cientifico IN ('Cochliomyia hominivorax', 'Dermatobia hominis', 'Oestrus ovis')
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia o
      WHERE o.id_vetor = vp.id_vetor
         OR o.id_parasito = vp.id_parasito
  );

DELETE FROM doenca_parasito dp
USING doenca d, parasito p
WHERE dp.id_doenca = d.id_doenca
  AND dp.id_parasito = p.id_parasito
  AND d.nome_cientifico = U&'Mi\00EDase'
  AND p.nome_cientifico IN ('Cochliomyia hominivorax', 'Dermatobia hominis', 'Oestrus ovis')
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia o
      WHERE o.id_doenca = dp.id_doenca
         OR o.id_parasito = dp.id_parasito
  );

DELETE FROM vetor v
WHERE v.nome_cientifico IN ('Cochliomyia hominivorax', 'Dermatobia hominis', 'Oestrus ovis')
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia o
      WHERE o.id_vetor = v.id_vetor
  )
  AND NOT EXISTS (
      SELECT 1
      FROM vetor_parasito vp
      WHERE vp.id_vetor = v.id_vetor
  );

DELETE FROM parasito p
WHERE p.nome_cientifico IN ('Cochliomyia hominivorax', 'Dermatobia hominis', 'Oestrus ovis')
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia o
      WHERE o.id_parasito = p.id_parasito
  )
  AND NOT EXISTS (
      SELECT 1
      FROM doenca_parasito dp
      WHERE dp.id_parasito = p.id_parasito
  )
  AND NOT EXISTS (
      SELECT 1
      FROM vetor_parasito vp
      WHERE vp.id_parasito = p.id_parasito
  );

DELETE FROM doenca d
WHERE d.nome_cientifico = U&'Mi\00EDase'
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia o
      WHERE o.id_doenca = d.id_doenca
  )
  AND NOT EXISTS (
      SELECT 1
      FROM doenca_parasito dp
      WHERE dp.id_doenca = d.id_doenca
  );

DELETE FROM hospedeiro h
WHERE h.nome_cientifico IN (
    'Homo sapiens',
    'Bos taurus',
    'Capra hircus',
    'Ovis aries',
    'Canis lupus familiaris',
    'Equus caballus'
)
  AND NOT EXISTS (
      SELECT 1
      FROM ocorrencia o
      WHERE o.id_hospedeiro = h.id_hospedeiro
  );

DELETE FROM categoria_hospedeiro ch
WHERE ch.nome_categoria IN ('HUMANO', 'ANIMAL_PRODUCAO', 'ANIMAL_COMPANHIA')
  AND NOT EXISTS (
      SELECT 1
      FROM hospedeiro h
      WHERE h.id_categoria = ch.id_categoria
  )
  AND NOT EXISTS (
      SELECT 1
      FROM categoria_caracteristica cc
      WHERE cc.id_categoria = ch.id_categoria
  );

COMMIT;
