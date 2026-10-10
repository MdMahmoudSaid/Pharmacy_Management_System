#!/bin/sh
set -eu
DATABASE_URL="$MIGRATION_DATABASE_URL" node --import tsx src/db/migrate.ts
node --import tsx scripts/provision-runtime-role.ts
exec node server.js
