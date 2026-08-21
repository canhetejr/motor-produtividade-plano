#!/usr/bin/env bash
# Sobe (ou derruba) um Postgres local descartável para a suíte de integração
# do Kanban.
#
# Por que existe: as garantias da migration 20260820213000 — WIP que não
# estoura sob corrida, posição que não duplica, rollback integral — só se
# provam com duas conexões simultâneas de verdade. O projeto Supabase de
# integração serve ao isolamento entre organizações via PostgREST; para
# corrida de transação ele é lento e depende de credencial. Um cluster local
# dá o mesmo Postgres em segundos, sem tocar em banco de cliente.
#
# Uso:
#   scripts/postgres-teste-local.sh iniciar   # imprime a URL na saída
#   scripts/postgres-teste-local.sh parar
#
#   export KANBAN_TESTE_PG_URL="$(scripts/postgres-teste-local.sh iniciar)"
#   npm run test:kanban
set -euo pipefail

PORTA="${KANBAN_TESTE_PG_PORTA:-55432}"
BASE="${KANBAN_TESTE_PG_DIR:-${TMPDIR:-/tmp}/vertice-pg-teste}"
DADOS="$BASE/data"

achar_bin() {
  if command -v pg_ctl >/dev/null 2>&1; then dirname "$(command -v pg_ctl)"; return; fi
  for dir in /usr/lib/postgresql/*/bin /usr/local/pgsql/bin /opt/homebrew/opt/postgresql*/bin; do
    [ -x "$dir/pg_ctl" ] && { echo "$dir"; return; }
  done
  echo "Nenhum pg_ctl encontrado. Instale o PostgreSQL para rodar a suíte." >&2
  exit 1
}
BIN="$(achar_bin)"

case "${1:-iniciar}" in
  iniciar)
    if [ ! -d "$DADOS" ]; then
      mkdir -p "$DADOS"
      # -A trust: cluster efêmero, sem rede externa e sem dado real. Não há
      # senha nem segredo envolvido em nenhum ponto desta suíte.
      "$BIN/initdb" -D "$DADOS" -A trust -U postgres >/dev/null
    fi
    if ! "$BIN/pg_ctl" -D "$DADOS" status >/dev/null 2>&1; then
      "$BIN/pg_ctl" -D "$DADOS" -l "$BASE/postgres.log" \
        -o "-p $PORTA -k $BASE -c listen_addresses=127.0.0.1" -w start >/dev/null
    fi
    echo "postgresql://postgres@127.0.0.1:$PORTA/postgres"
    ;;
  parar)
    "$BIN/pg_ctl" -D "$DADOS" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$BASE"
    ;;
  *)
    echo "Uso: $0 [iniciar|parar]" >&2
    exit 1
    ;;
esac
