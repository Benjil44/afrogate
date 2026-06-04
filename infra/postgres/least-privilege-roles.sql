-- Afrows PostgreSQL least-privilege grants.
--
-- Run this as a PostgreSQL superuser connected to the Afrows database after
-- creating these roles with deployment-secret passwords:
--
--   CREATE ROLE afrows_owner NOLOGIN;
--   CREATE ROLE afrows_migrator LOGIN PASSWORD 'replace-with-migration-password';
--   CREATE ROLE afrows_app LOGIN PASSWORD 'replace-with-runtime-password';
--
-- The backend runtime should use afrows_app through DATABASE_URL.
-- The migration command should use afrows_migrator through DATABASE_MIGRATION_URL.
-- Existing single-role deployments may need a manual object-ownership migration
-- after a backup before future DDL-heavy migrations can run as afrows_migrator.

REVOKE ALL ON DATABASE afrows FROM PUBLIC;
GRANT CONNECT ON DATABASE afrows TO afrows_app, afrows_migrator;
GRANT CREATE ON DATABASE afrows TO afrows_migrator;

ALTER SCHEMA public OWNER TO afrows_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO afrows_app, afrows_migrator;
GRANT CREATE ON SCHEMA public TO afrows_migrator;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afrows_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO afrows_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO afrows_app;

ALTER DEFAULT PRIVILEGES FOR ROLE afrows_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO afrows_app;
ALTER DEFAULT PRIVILEGES FOR ROLE afrows_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO afrows_app;
ALTER DEFAULT PRIVILEGES FOR ROLE afrows_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO afrows_app;
ALTER DEFAULT PRIVILEGES FOR ROLE afrows_migrator IN SCHEMA public
  GRANT USAGE ON TYPES TO afrows_app;
