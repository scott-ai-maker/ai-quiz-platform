#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3006}"

echo "Running AI orchestration smoke test against ${BASE_URL}"

health_code=$(curl -s -o /tmp/ai_orch_health.json -w "%{http_code}" "${BASE_URL}/health")
if [[ "$health_code" != "200" ]]; then
  echo "❌ Health check failed: ${health_code}"
  exit 1
fi

generate_code=$(curl -s -o /tmp/ai_orch_generate.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/ai/generate-question" \
  -H "Content-Type: application/json" \
  -d '{"topic":"JavaScript Promises","difficulty":"intermediate"}')

if [[ "$generate_code" != "200" ]]; then
  echo "❌ Generate endpoint failed: ${generate_code}"
  cat /tmp/ai_orch_generate.json
  exit 1
fi

echo "✅ Smoke test passed"
cat /tmp/ai_orch_generate.json
