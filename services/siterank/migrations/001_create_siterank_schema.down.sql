-- Down migration: Drop siterank schema

DROP TABLE IF EXISTS siterank.domain_cache CASCADE;
DROP TABLE IF EXISTS siterank.website_info_cache CASCADE;
DROP TABLE IF EXISTS siterank.evaluation_aggregations CASCADE;
DROP TABLE IF EXISTS siterank.website_info CASCADE;
DROP TABLE IF EXISTS siterank.analyses CASCADE;
DROP FUNCTION IF EXISTS siterank.update_updated_at_column() CASCADE;
DROP SCHEMA IF EXISTS siterank CASCADE;
