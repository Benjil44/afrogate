param(
  [string]$PostgresPassword = "afrows",
  [string]$DatabaseName = "afrows",
  [string]$DatabaseOwner = "afrows_owner",
  [string]$DatabaseMigrator = "afrows_migrator",
  [string]$DatabaseMigratorPassword = "afrows_migrator",
  [string]$DatabaseUser = "afrows_app",
  [string]$DatabasePassword = "afrows",
  [int]$Port = 5432,
  [switch]$SkipInstall,
  [switch]$WriteEnv
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-SafeIdentifier([string]$Value, [string]$Name) {
  if ($Value -notmatch "^[A-Za-z_][A-Za-z0-9_]*$") {
    throw "$Name must be a simple SQL identifier. Received: $Value"
  }
}

function Escape-SqlLiteral([string]$Value) {
  return $Value.Replace("'", "''")
}

function Find-Psql {
  $command = Get-Command psql -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending

  if ($candidates) {
    return $candidates[0].FullName
  }

  return $null
}

function Invoke-Postgres([string]$Database, [string]$Sql) {
  $previousPassword = $env:PGPASSWORD
  $env:PGPASSWORD = $PostgresPassword

  try {
    & $script:psqlPath `
      -h 127.0.0.1 `
      -p $Port `
      -U postgres `
      -d $Database `
      -v ON_ERROR_STOP=1 `
      -c $Sql
  } finally {
    if ($null -eq $previousPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $previousPassword
    }
  }
}

function Invoke-PostgresScalar([string]$Database, [string]$Sql) {
  $previousPassword = $env:PGPASSWORD
  $env:PGPASSWORD = $PostgresPassword

  try {
    $result = & $script:psqlPath `
      -h 127.0.0.1 `
      -p $Port `
      -U postgres `
      -d $Database `
      -tAc $Sql

    if ($null -eq $result) {
      return ""
    }

    return ($result | Out-String).Trim()
  } finally {
    if ($null -eq $previousPassword) {
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $previousPassword
    }
  }
}

Assert-SafeIdentifier $DatabaseName "DatabaseName"
Assert-SafeIdentifier $DatabaseOwner "DatabaseOwner"
Assert-SafeIdentifier $DatabaseMigrator "DatabaseMigrator"
Assert-SafeIdentifier $DatabaseUser "DatabaseUser"

$script:psqlPath = Find-Psql

if (-not $script:psqlPath -and -not $SkipInstall) {
  if (-not (Test-IsAdministrator)) {
    throw "PostgreSQL install requires Administrator PowerShell. Re-run this script as Administrator or install PostgreSQL manually first."
  }

  $choco = Get-Command choco -ErrorAction SilentlyContinue
  if (-not $choco) {
    throw "Chocolatey is required for automatic install. Install PostgreSQL manually, then re-run with -SkipInstall."
  }

  choco install postgresql18 -y --params "/Password:$PostgresPassword /Port:$Port" --execution-timeout=1800 --no-progress
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  $script:psqlPath = Find-Psql
}

if (-not $script:psqlPath) {
  throw "psql was not found. Install PostgreSQL and make sure psql.exe is available."
}

$roleName = '"' + $DatabaseUser + '"'
$ownerRoleName = '"' + $DatabaseOwner + '"'
$migratorRoleName = '"' + $DatabaseMigrator + '"'
$dbName = '"' + $DatabaseName + '"'
$userLiteral = Escape-SqlLiteral $DatabaseUser
$ownerLiteral = Escape-SqlLiteral $DatabaseOwner
$migratorLiteral = Escape-SqlLiteral $DatabaseMigrator
$dbLiteral = Escape-SqlLiteral $DatabaseName
$passwordLiteral = Escape-SqlLiteral $DatabasePassword
$migratorPasswordLiteral = Escape-SqlLiteral $DatabaseMigratorPassword

$ownerExists = Invoke-PostgresScalar "postgres" "SELECT 1 FROM pg_roles WHERE rolname = '$ownerLiteral';"
if ($ownerExists -eq "1") {
  Invoke-Postgres "postgres" "ALTER ROLE $ownerRoleName WITH NOLOGIN;"
} else {
  Invoke-Postgres "postgres" "CREATE ROLE $ownerRoleName NOLOGIN;"
}

$migratorExists = Invoke-PostgresScalar "postgres" "SELECT 1 FROM pg_roles WHERE rolname = '$migratorLiteral';"
if ($migratorExists -eq "1") {
  Invoke-Postgres "postgres" "ALTER ROLE $migratorRoleName WITH LOGIN PASSWORD '$migratorPasswordLiteral';"
} else {
  Invoke-Postgres "postgres" "CREATE ROLE $migratorRoleName LOGIN PASSWORD '$migratorPasswordLiteral';"
}

$roleExists = Invoke-PostgresScalar "postgres" "SELECT 1 FROM pg_roles WHERE rolname = '$userLiteral';"
if ($roleExists -eq "1") {
  Invoke-Postgres "postgres" "ALTER ROLE $roleName WITH LOGIN PASSWORD '$passwordLiteral';"
} else {
  Invoke-Postgres "postgres" "CREATE ROLE $roleName LOGIN PASSWORD '$passwordLiteral';"
}

$databaseExists = Invoke-PostgresScalar "postgres" "SELECT 1 FROM pg_database WHERE datname = '$dbLiteral';"
if ($databaseExists -ne "1") {
  Invoke-Postgres "postgres" "CREATE DATABASE $dbName OWNER $ownerRoleName;"
} else {
  Invoke-Postgres "postgres" "ALTER DATABASE $dbName OWNER TO $ownerRoleName;"
}

function Apply-LeastPrivilegeGrants {
  Invoke-Postgres $DatabaseName @"
REVOKE ALL ON DATABASE $dbName FROM PUBLIC;
GRANT CONNECT ON DATABASE $dbName TO $roleName, $migratorRoleName;
GRANT CREATE ON DATABASE $dbName TO $migratorRoleName;
ALTER SCHEMA public OWNER TO $ownerRoleName;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO $roleName, $migratorRoleName;
GRANT CREATE ON SCHEMA public TO $migratorRoleName;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $roleName;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO $roleName;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO $roleName;
ALTER DEFAULT PRIVILEGES FOR ROLE $migratorRoleName IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $roleName;
ALTER DEFAULT PRIVILEGES FOR ROLE $migratorRoleName IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO $roleName;
ALTER DEFAULT PRIVILEGES FOR ROLE $migratorRoleName IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO $roleName;
ALTER DEFAULT PRIVILEGES FOR ROLE $migratorRoleName IN SCHEMA public
  GRANT USAGE ON TYPES TO $roleName;
"@
}

Apply-LeastPrivilegeGrants

$databaseUrl = "postgresql://${DatabaseUser}:${DatabasePassword}@localhost:${Port}/${DatabaseName}"
$migrationDatabaseUrl = "postgresql://${DatabaseMigrator}:${DatabaseMigratorPassword}@localhost:${Port}/${DatabaseName}"

if ($WriteEnv) {
  $envPath = Join-Path (Get-Location) ".env"

  if (Test-Path $envPath) {
    Write-Host ".env already exists; not overwriting it."
  } else {
    @"
PORT=7000
CORS_ORIGIN=http://127.0.0.1:4000,http://localhost:4000
DATABASE_URL=$databaseUrl
DATABASE_MIGRATION_URL=$migrationDatabaseUrl
DATABASE_POOL_MAX=5
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true
AFROWS_AGENT_TOKEN=local-direct-agent-token
AFROWS_SUPERADMIN_USERNAME=superadmin
AFROWS_SUPERADMIN_PASSWORD=local-superadmin-pass-2026!
ADMIN_SESSION_SECRET=local-direct-dev-session-secret-not-for-production
ADMIN_SESSION_TTL_SECONDS=28800
AFROWS_ADMIN_USERS_FILE=tmp/admin-users.json
AFROWS_ADMIN_TOKEN=local-direct-admin-token
AFROWS_OUTBOUND_PROXY_URL=
VITE_API_BASE_URL=http://127.0.0.1:7000/api
AFROWS_AGENT_ID=local-dev-agent
AFROWS_API_URL=http://127.0.0.1:7000/api
AFROWS_PUSH_INTERVAL_SECONDS=10
AFROWS_AGENT_STATE_FILE=
"@ | Set-Content -Path $envPath -Encoding UTF8
  }
}

$previousDatabaseUrl = $env:DATABASE_URL
$previousMigrationDatabaseUrl = $env:DATABASE_MIGRATION_URL
$env:DATABASE_URL = $databaseUrl
$env:DATABASE_MIGRATION_URL = $migrationDatabaseUrl

try {
  npm --workspace @afrows/backend run db:migrate
} finally {
  if ($null -eq $previousDatabaseUrl) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:DATABASE_URL = $previousDatabaseUrl
  }

  if ($null -eq $previousMigrationDatabaseUrl) {
    Remove-Item Env:DATABASE_MIGRATION_URL -ErrorAction SilentlyContinue
  } else {
    $env:DATABASE_MIGRATION_URL = $previousMigrationDatabaseUrl
  }
}

Apply-LeastPrivilegeGrants

Write-Host "Local PostgreSQL runtime URL is ready: $databaseUrl"
Write-Host "Local PostgreSQL migration URL is ready: $migrationDatabaseUrl"
