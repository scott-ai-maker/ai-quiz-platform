#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3007}"

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

assert_code() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label ($actual)"
  else
    fail "$label expected $expected but got $actual"
  fi
}

echo "Running prompt-framework-service smoke tests against ${BASE_URL}"

health_code=$(curl -s -o /tmp/prompt_smoke_health.json -w "%{http_code}" "${BASE_URL}/health")
assert_code "$health_code" "200" "Health endpoint"

create_code=$(curl -s -o /tmp/prompt_smoke_create.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/prompts/templates" \
  -H "Content-Type: application/json" \
  -d '{"template_key":"quiz.question.mcq.smoke","version":1,"description":"Smoke test template","template_text":"Create a {{difficulty}} quiz question about {{topic}}."}')
assert_code "$create_code" "201" "Template creation"

get_code=$(curl -s -o /tmp/prompt_smoke_get.json -w "%{http_code}" \
  "${BASE_URL}/api/prompts/templates/quiz.question.mcq.smoke")
assert_code "$get_code" "200" "Get active template by key"

render_code=$(curl -s -o /tmp/prompt_smoke_render.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/prompts/render" \
  -H "Content-Type: application/json" \
  -d '{"template_key":"quiz.question.mcq.smoke","variables":{"difficulty":"hard","topic":"distributed systems"}}')
assert_code "$render_code" "200" "Render prompt"

bad_render_code=$(curl -s -o /tmp/prompt_smoke_bad_render.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/prompts/render" \
  -H "Content-Type: application/json" \
  -d '{"template_key":"quiz.question.mcq.smoke","variables":{"difficulty":"hard"}}')
assert_code "$bad_render_code" "400" "Missing variable validation"

echo
echo "Smoke tests passed. Artifacts: /tmp/prompt_smoke_*.json"
