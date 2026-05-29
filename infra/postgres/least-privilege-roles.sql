-- AfroGate PostgreSQL least-privilege grants.
--
-- Run this as a PostgreSQL superuser connected to the AfroGate database after
-- creating these roles with deployment-secret passwords:
--
--   CREATE ROLE afrogate_owner NOLOGIN;
--   CREATE ROLE afrogate_migrator LOGIN PASSWORD 'replace-with-migration-password';
--   CREATE ROLE afrogate_app LOGIN PASSWORD 'replace-with-runtime-password';
--
-- The backend runtime should use afrogate_app through DATABASE_URL.
-- The migration command should use afrogate_migrator through DATABASE_MIGRATION_URL.
-- Existing single-role deployments may need a manual object-ownership migration
-- after a backup before future DDL-heavy migrations can run as afrogate_migrator.

REVOKE ALL ON DATABASE afrogate FROM PUBLIC;
GRANT CONNECT ON DATABASE afrogate TO afrogate_app, afrogate_migrator;
GRANT CREATE ON DATABASE afrogate TO afrogate_migrator;

ALTER SCHEMA public OWNER TO afrogate_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO afrogate_app, afrogate_migrator;
GRANT CREATE ON SCHEMA public TO afrogate_migrator;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afrogate_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO afrogate_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO afrogate_app;

ALTER DEFAULT PRIVILEGES FOR ROLE afrogate_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO afrogate_app;
ALTER DEFAULT PRIVILEGES FOR ROLE afrogate_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO afrogate_app;
ALTER DEFAULT PRIVILEGES FOR ROLE afrogate_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO afrogate_app;
ALTER DEFAULT PRIVILEGES FOR ROLE afrogate_migrator IN SCHEMA public
  GRANT USAGE ON TYPES TO afrogate_app;
