#!/bin/bash

# Script para probar la API localmente

API_URL="http://localhost:3000"

echo "🧪 Probando ICN API..."
echo ""

# Test 1: Health check
echo "1️⃣  Health Check"
curl -s "$API_URL/api/health" | jq .
echo ""
echo ""

# Test 2: Análisis de artículo simple
echo "2️⃣  Análisis de Noticia"
TEXTO='El Banco Central anunció hoy nuevas medidas de política monetaria para controlar la inflación. Las tasas de interés se incrementarán en 50 puntos base a partir de la próxima semana. El presidente del organismo explicó que esta decisión busca anclar las expectativas inflacionarias. Economistas consultados consideran que la medida era necesaria. Se espera que el anuncio tenga impacto en los mercados financieros durante las próximas sesiones.'

curl -s -X POST "$API_URL/api/analyze" \
  -H "Content-Type: application/json" \
  -d "{
    \"texto\": \"$TEXTO\",
    \"tipo\": \"noticia\"
  }" | jq .

echo ""
echo "✅ Tests completados"
