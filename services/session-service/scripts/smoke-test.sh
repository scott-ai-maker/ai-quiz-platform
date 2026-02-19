#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3005}"
PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_DB="${PG_DB:-quiz_db}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-postgres123}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

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

echo "Running session-service smoke tests against ${BASE_URL}"

health_code=$(curl -s -o /tmp/session_smoke_health.json -w "%{http_code}" "${BASE_URL}/health")
assert_code "$health_code" "200" "Health endpoint"

bad_json_code=$(curl -s -o /tmp/session_smoke_400.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/sessions/start" \
  -H "Content-Type: application/json" \
  --data '{"user_id":"abc"')
assert_code "$bad_json_code" "400" "Malformed JSON returns 400"

not_found_id="550e8400-e29b-41d4-a716-446655440111"
not_found_code=$(curl -s -o /tmp/session_smoke_404.json -w "%{http_code}" \
  "${BASE_URL}/api/sessions/${not_found_id}")
assert_code "$not_found_code" "404" "Unknown session returns 404"

create_code=$(curl -s -o /tmp/session_smoke_create.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/sessions/start" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"smoke-user","quiz_id":101}')
assert_code "$create_code" "201" "Session creation"

session_id=$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('/tmp/session_smoke_create.json','utf8'));console.log(p.id||'');")
[[ -n "$session_id" ]] || fail "Could not parse session id from create response"

echo "Created session: ${session_id}"

# Conflict test: 40 concurrent updates should produce at least one 409
race_results=$(seq 1 40 | xargs -I{} -P 20 sh -c \
  "curl -s -o /tmp/session_smoke_race_{}.json -w '%{http_code}\n' -X PUT '${BASE_URL}/api/sessions/${session_id}/progress' -H 'Content-Type: application/json' -d '{\"question_id\":3,\"answer\":\"ans{}\"}'")

conflict_count=$(echo "$race_results" | grep -c '^409$' || true)
if [[ "$conflict_count" -gt 0 ]]; then
  pass "Optimistic locking conflict observed (${conflict_count} x 409)"
else
  fail "Expected at least one 409 conflict during race test"
fi

# Force expiry + clear cache so GET path checks DB expiry
SESSION_ID="$session_id" \
PG_HOST="$PG_HOST" PG_PORT="$PG_PORT" PG_DB="$PG_DB" PG_USER="$PG_USER" PG_PASSWORD="$PG_PASSWORD" \
REDIS_HOST="$REDIS_HOST" REDIS_PORT="$REDIS_PORT" \
node <<'NODE'
const { Pool } = require('pg');
const redis = require('redis');

(async () => {
  const pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    database: process.env.PG_DB,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  });

  const redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    },
  });

  try {
    await pool.query(
      "UPDATE quiz_sessions SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1",
      [process.env.SESSION_ID]
    );

    await redisClient.connect();
    await redisClient.del(`session:${process.env.SESSION_ID}`);
  } finally {
    await redisClient.quit().catch(() => {});
    await pool.end().catch(() => {});
  }
})();
NODE

expired_code=$(curl -s -o /tmp/session_smoke_410.json -w "%{http_code}" \
  "${BASE_URL}/api/sessions/${session_id}")
assert_code "$expired_code" "410" "Expired session returns 410"

echo "\nSmoke tests passed."
echo "Artifacts: /tmp/session_smoke_*.json"
