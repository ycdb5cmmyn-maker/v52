#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

curl -sS "$BASE_URL/api/health" | cat

echo

curl -sS -X POST "$BASE_URL/api/analyze" \
  -H 'Content-Type: application/json' \
  -d '{"type":"noticia","text":"'"$(printf '%*s' 120 | tr ' ' a)"'"}' | cat

echo
