#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3009}"

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

echo "Running content-verification-service smoke tests against ${BASE_URL}"

health_code=$(curl -s -o /tmp/verify_smoke_health.json -w "%{http_code}" "${BASE_URL}/health")
assert_code "$health_code" "200" "Health endpoint"

verify_code=$(curl -s -o /tmp/verify_smoke_verify.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/verification/verify" \
  -H "Content-Type: application/json" \
  -d '{"topic":"Distributed systems","difficulty":"intermediate","question":"Which choice best describes eventual consistency in distributed databases?","options":["Writes become visible over time","Writes are always instantly global","No replicas are used","Consistency is disabled"],"answer":0}')
assert_code "$verify_code" "200" "Content verification"

async_code=$(curl -s -o /tmp/verify_smoke_async_create.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/verification/verify/async" \
  -H "Content-Type: application/json" \
  -d '{"topic":"Message queues","difficulty":"easy","question":"Which statement best describes message queue durability?","options":["Messages can survive broker restarts when persisted","Messages are always in memory only","Durability removes ordering guarantees entirely","Durability means no acknowledgments are needed"],"answer":0}')
assert_code "$async_code" "202" "Async verification submission"

job_id=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/tmp/verify_smoke_async_create.json','utf8'));console.log(d.job_id||'')")
[[ -n "$job_id" ]] || fail "Could not parse async verification job id"

for i in $(seq 1 20); do
  status_code=$(curl -s -o /tmp/verify_smoke_async_status.json -w "%{http_code}" "${BASE_URL}/api/verification/jobs/${job_id}")
  [[ "$status_code" == "200" ]] || fail "Async job status endpoint returned ${status_code}"

  status=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('/tmp/verify_smoke_async_status.json','utf8'));console.log(d.status||'')")
  if [[ "$status" == "completed" ]]; then
    pass "Async verification completed"
    break
  fi

  if [[ "$status" == "failed" ]]; then
    fail "Async verification failed"
  fi

  sleep 0.3
done

echo
echo "Smoke tests passed. Artifacts: /tmp/verify_smoke_*.json"