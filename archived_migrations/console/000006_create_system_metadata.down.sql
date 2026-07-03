-- Down migration: Drop console schema metadata tables

DROP TABLE IF EXISTS console.domain_mappings CASCADE;
DROP TABLE IF EXISTS console.system_metadata CASCADE;
DROP FUNCTION IF EXISTS console.update_updated_at_column() CASCADE;
DROP SCHEMA IF EXISTS console CASCADE;
