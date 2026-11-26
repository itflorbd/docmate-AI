#!/bin/sh
# Rebuild the disposable integration database with synthetic data only.
# usage: sh scripts/setup-disposable-db.sh [db_name] [library_source_db]
set -e
DB=${1:-docmate_integration}
LIB=${2:-docmate_judges}
export DATABASE_URL="postgresql://$(whoami)@localhost:5432/$DB"
dropdb --if-exists "$DB"
createdb "$DB"
psql -d "$DB" -qc 'CREATE EXTENSION IF NOT EXISTS vector'
npm run -s migrate
npm run -s seed
for s in seed-phase3-patients seed-phase4-dgda-formulary seed-phase5-portals seed-patient-features; do
  node --env-file=.env --import tsx scripts/$s.ts > /dev/null
done
# Synthetic demo library copied from another disposable database.
TMP=$(mktemp)
pg_dump -d "$LIB" --data-only -t sources -t source_versions -t source_files -t chunks 2>/dev/null | grep -v '^SELECT pg_catalog.set_config' > "$TMP"
{ echo "BEGIN; SET session_replication_role = replica;"; cat "$TMP";
  echo "UPDATE sources SET rights_confirmed_by = (SELECT id FROM users WHERE email='admin@docmate.ai') WHERE rights_confirmed_by IS NOT NULL AND rights_confirmed_by NOT IN (SELECT id FROM users);";
  echo "UPDATE source_versions SET created_by = (SELECT id FROM users WHERE email='admin@docmate.ai') WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM users);";
  echo "COMMIT;"; } | psql -d "$DB" -q -v ON_ERROR_STOP=1
rm -f "$TMP"
echo "chunks: $(psql -d "$DB" -Atc 'select count(*) from chunks')"
