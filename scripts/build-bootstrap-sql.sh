#!/usr/bin/env bash
# Concatenates prisma/migrations/* in chronological order into a single
# prisma/bootstrap.sql that can be pasted into the Supabase SQL Editor to build
# the schema from nothing.
#
# Why this exists: migrations here are applied by hand in the SQL Editor (the
# pooler isn't reachable over IPv6 from the dev machine), so `prisma migrate
# deploy` is not an option. Rebuilding a lost project otherwise means opening
# seven files and pasting them in the right order — easy to get wrong, and a
# wrong order fails halfway leaving a half-built schema.
#
# Usage: ./scripts/build-bootstrap-sql.sh
set -euo pipefail

cd "$(dirname "$0")/.."

OUT=prisma/bootstrap.sql

{
  echo "-- ============================================================================"
  echo "-- Empire Signal — full schema bootstrap"
  echo "--"
  echo "-- Paste this whole file into the Supabase SQL Editor of a NEW project and run"
  echo "-- it once. It is prisma/migrations/* concatenated in chronological order, so"
  echo "-- the result matches the schema the app expects."
  echo "--"
  echo "-- GENERATED FILE — do not edit by hand."
  echo "-- Regenerate with ./scripts/build-bootstrap-sql.sh after adding a migration."
  echo "-- ============================================================================"
  echo

  for dir in prisma/migrations/*/; do
    [ -f "$dir/migration.sql" ] || continue
    echo "-- ─────────────────────────────────────────────────────────────────────────"
    echo "-- $(basename "$dir")"
    echo "-- ─────────────────────────────────────────────────────────────────────────"
    cat "$dir/migration.sql"
    echo
  done
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT") lines, $(ls -d prisma/migrations/*/ | wc -l) migrations)"
