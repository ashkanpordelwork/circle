#!/usr/bin/env bash
# Runs the migration and the access-rule tests on a throwaway Postgres in Docker.
#   scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
name=coach-app-testdb
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16-alpine >/dev/null
trap 'docker rm -f "$name" >/dev/null' EXIT
export PGPASSWORD=pg
for i in $(seq 30); do psql -h localhost -p 55432 -U postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
psql -h localhost -p 55432 -U postgres -q -v ON_ERROR_STOP=1 \
  -f supabase/tests/supabase-shim.sql -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_phone_login.sql -f supabase/migrations/0003_tempo.sql -f supabase/migrations/0004_intake.sql -f supabase/migrations/0005_admin.sql -f supabase/migrations/0006_programs.sql -f supabase/migrations/0007_smart.sql -f supabase/migrations/0008_athletes.sql -f supabase/migrations/0009_body.sql -f supabase/migrations/0010_coaching.sql -f supabase/migrations/0011_nutrition.sql -f supabase/migrations/0012_profiles.sql \
  -f supabase/tests/rls.test.sql -f supabase/tests/phone.test.sql -f supabase/tests/tempo.test.sql -f supabase/tests/intake.test.sql -f supabase/tests/program.test.sql -f supabase/tests/admin.test.sql -f supabase/tests/smart.test.sql -f supabase/tests/athletes.test.sql -f supabase/tests/body.test.sql -f supabase/tests/coaching.test.sql -f supabase/tests/nutrition.test.sql -f supabase/tests/profiles.test.sql
