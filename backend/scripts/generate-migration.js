const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const diff = execSync(
  'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { cwd: path.resolve(__dirname, '..') }
).toString();

const fullSql = `-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

${diff}

-- PostGIS Spatial Indexes (Geography Cast for index-driven ST_DWithin)
CREATE INDEX IF NOT EXISTS idx_providers_spatial ON "providers" USING GIST (
  (ST_SetSRID(ST_MakePoint("currentLongitude", "currentLatitude"), 4326)::geography)
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_spatial ON "user_addresses" USING GIST (
  (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography)
);

CREATE INDEX IF NOT EXISTS idx_bookings_spatial ON "bookings" USING GIST (
  (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography)
);
`;

const migrationPath = path.resolve(
  __dirname,
  '../prisma/migrations/20261109000000_init_postgis/migration.sql'
);
fs.writeFileSync(migrationPath, fullSql, 'utf8');
console.log('✅ Formatted migration.sql successfully regenerated with PostGIS and Restrict constraints!');
