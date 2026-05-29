-- Quick manual check for the default AfroGate PostgreSQL role layout.
-- Run connected to the AfroGate database as a superuser or owner.

SELECT
  current_database() AS database_name,
  has_database_privilege('afrogate_app', current_database(), 'CONNECT') AS app_can_connect,
  has_database_privilege('afrogate_app', current_database(), 'CREATE') AS app_database_create_should_be_false,
  has_database_privilege('afrogate_migrator', current_database(), 'CREATE') AS migrator_database_create_should_be_true,
  has_schema_privilege('afrogate_app', 'public', 'USAGE') AS app_schema_usage,
  has_schema_privilege('afrogate_app', 'public', 'CREATE') AS app_schema_create_should_be_false,
  has_schema_privilege('afrogate_migrator', 'public', 'USAGE') AS migrator_schema_usage,
  has_schema_privilege('afrogate_migrator', 'public', 'CREATE') AS migrator_schema_create_should_be_true;
