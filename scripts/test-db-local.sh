#!/usr/bin/env bash
set -Eeuo pipefail

# Destructive only to these disposable LOCAL test databases; never accepts a URL.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SOCKET=/var/run/postgresql
PSQL=(sudo -u postgres psql -X -h "$SOCKET" -v ON_ERROR_STOP=1 -P pager=off)
TEST_ROOT=$(mktemp -d /tmp/stampee-db-tests.XXXXXX)
cleanup() {
  for db in stampee_release_test stampee_card_codes_test; do
    sudo -u postgres dropdb -h "$SOCKET" --if-exists --maintenance-db=postgres "$db" >/dev/null 2>&1 || true
  done
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

# postgres reads only public source/fixtures copied here, not private repository files.
mkdir -p "$TEST_ROOT/supabase/tests"
for file in migration multi_business card_codes staff_pin_fix platform_access_phase1; do
  cp "$ROOT/supabase/$file.sql" "$TEST_ROOT/supabase/"
done
for file in setup_local staff_pin card_codes; do
  cp "$ROOT/supabase/tests/$file.sql" "$TEST_ROOT/supabase/tests/"
done
find "$TEST_ROOT" -type d -exec chmod 755 {} +
find "$TEST_ROOT" -type f -exec chmod 644 {} +

run_suite() {
  local db=$1 suite=$2
  printf 'Testing %s with canonical migrations\n' "$suite"
  sudo -u postgres dropdb -h "$SOCKET" --if-exists --maintenance-db=postgres "$db" >/dev/null
  sudo -u postgres createdb -h "$SOCKET" --maintenance-db=postgres "$db"
  "${PSQL[@]}" -d "$db" -f "$TEST_ROOT/supabase/tests/setup_local.sql" >/dev/null
  "${PSQL[@]}" -d "$db" -f "$TEST_ROOT/supabase/card_codes.sql" >/dev/null
  "${PSQL[@]}" -d "$db" -f "$TEST_ROOT/supabase/staff_pin_fix.sql" >/dev/null
  "${PSQL[@]}" -d "$db" -f "$TEST_ROOT/supabase/platform_access_phase1.sql" >/dev/null
  "${PSQL[@]}" -d "$db" -f "$TEST_ROOT/supabase/tests/$suite"
  sudo -u postgres dropdb -h "$SOCKET" --if-exists --maintenance-db=postgres "$db" >/dev/null
}

run_suite stampee_release_test staff_pin.sql
run_suite stampee_card_codes_test card_codes.sql
printf '%s\n' 'LOCAL_DB_TESTS_OK'
