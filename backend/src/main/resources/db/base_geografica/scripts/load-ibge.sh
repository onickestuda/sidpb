#!/usr/bin/env bash
set -Eeuo pipefail

echo "Iniciando carregamento de dados do ibge"

: "${PGHOST:=db}"
: "${PGPORT:=5432}"
: "${PGDATABASE:=sidpb_db}"
: "${PGUSER:=sidpb_admin}"
: "${SHAPE_ENCODING:=UTF-8}"

: "${REGIOES_SHP:?Informe o caminho do shapefile de regioes em REGIOES_SHP}"
: "${ESTADOS_SHP:?Informe o caminho do shapefile de estados em ESTADOS_SHP}"
: "${MUNICIPIOS_SHP:?Informe o caminho do shapefile de municipios em MUNICIPIOS_SHP}"
: "${TRANSFORMACAO_STG_TO_DB:?Informe o caminho do arquivo SQL de transformacao em TRANSFORMACAO_STG_TO_DB}"

echo "Verificando dependencias"
command -v psql >/dev/null 2>&1 || { 
  echo "psql nao encontrado"
  exit 1
}
command -v shp2pgsql >/dev/null 2>&1 || { 
  echo "shp2pgsql nao encontrado"
  exit 1
}

# verifica ausência de bibliotecas necessárias do shp2pgsql
TIMEOUT=60

echo "Aguardando o banco ficar disponível"

until pg_isready -h "$PGHOST" -p "$PGPORT" -d "$PGDATABASE" -U "$PGUSER" || [ $TIMEOUT -le 0 ]; do

  sleep 3
  TIMEOUT=$((TIMEOUT - 3))

done

if [ $TIMEOUT -le 0 ]; then

  echo "Timeout atingido. O banco nao esta disponivel."
  exit 1

else

  echo "Banco disponivel."

fi

echo "Verificando se schema inicial foi aplicado"

psql -v ON_ERROR_STOP=1 <<'STOP'
DO $$
BEGIN
    IF to_regclass('public.regiao') IS NULL THEN
      RAISE EXCEPTION 'tabela regiao não encontrada. Execute o schema inicial.';
    END IF;
    IF to_regclass('public.estado') IS NULL THEN
      RAISE EXCEPTION 'tabela estado não encontrada. Execute o schema inicial.';
    END IF;
    IF to_regclass('public.municipio') IS NULL THEN
      RAISE EXCEPTION 'tabela municipio não encontrada. Execute o schema inicial.';
    END IF;
END $$;
STOP

# Carregando dados do ibge

echo "Iniciando carregamento de dados do ibge"
check_file(){
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "Arquivo $file nao encontrado no caminho fornecido."
    exit 1
    fi
}

check_file "$REGIOES_SHP"
check_file "$ESTADOS_SHP"
check_file "$MUNICIPIOS_SHP"

copy_shp_to_db(){
  local shp_path="$1"
  local staging_table="$2"

  echo "Removendo staging antiga public.$staging_table, se existir"
  psql -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS public.${staging_table} CASCADE;"

  echo "Importando $shp_path para $staging_table"

  shp2pgsql -c -I -D -s 4674 -W "$SHAPE_ENCODING" -g geom "$shp_path" "public.$staging_table" | psql -v ON_ERROR_STOP=1

  echo "public.$staging_table" foi carregada com sucesso
}

copy_shp_to_db "$REGIOES_SHP" "stg_ibge_regioes"
copy_shp_to_db "$ESTADOS_SHP" "stg_ibge_estados"
copy_shp_to_db "$MUNICIPIOS_SHP" "stg_ibge_municipios"

echo "Transformando staging para tabelas finais"

psql -v ON_ERROR_STOP=1 -f "$TRANSFORMACAO_STG_TO_DB"

echo "Carregamento de dados do ibge concluido com sucesso"