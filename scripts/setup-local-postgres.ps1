param(
  [string]$PostgresPassword = "afrogate",
  [string]$DatabaseName = "afrogate",
  [string]$DatabaseUser = "afrogate",
  [string]$DatabasePassword = "afrogate",
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
$dbName = '"' + $DatabaseName + '"'
$userLiteral = Escape-SqlLiteral $DatabaseUser
$dbLiteral = Escape-SqlLiteral $DatabaseName
$passwordLiteral = Escape-SqlLiteral $DatabasePassword

$roleExists = Invoke-PostgresScalar "postgres" "SELECT 1 FROM pg_roles WHERE rolname = '$userLiteral';"
if ($roleExists -eq "1") {
  Invoke-Postgres "postgres" "ALTER ROLE $roleName WITH LOGIN PASSWORD '$passwordLiteral';"
} else {
  Invoke-Postgres "postgres" "CREATE ROLE $roleName LOGIN PASSWORD '$passwordLiteral';"
}

$databaseExists = Invoke-PostgresScalar "postgres" "SELECT 1 FROM pg_database WHERE datname = '$dbLiteral';"
if ($databaseExists -ne "1") {
  Invoke-Postgres "postgres" "CREATE DATABASE $dbName OWNER $roleName;"
}

Invoke-Postgres $DatabaseName "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $roleName;"

$databaseUrl = "postgresql://${DatabaseUser}:${DatabasePassword}@localhost:${Port}/${DatabaseName}"

if ($WriteEnv) {
  $envPath = Join-Path (Get-Location) ".env"

  if (Test-Path $envPath) {
    Write-Host ".env already exists; not overwriting it."
  } else {
    @"
PORT=7000
CORS_ORIGIN=http://127.0.0.1:4000,http://localhost:4000
DATABASE_URL=$databaseUrl
DATABASE_POOL_MAX=5
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true
AFROGATE_AGENT_TOKEN=local-direct-agent-token
AFROGATE_SUPERADMIN_USERNAME=superadmin
AFROGATE_SUPERADMIN_PASSWORD=local-superadmin-pass-2026!
ADMIN_SESSION_SECRET=local-direct-dev-session-secret-not-for-production
ADMIN_SESSION_TTL_SECONDS=28800
AFROGATE_ADMIN_USERS_FILE=tmp/admin-users.json
AFROGATE_ADMIN_TOKEN=local-direct-admin-token
AFROGATE_OUTBOUND_PROXY_URL=
VITE_API_BASE_URL=http://127.0.0.1:7000/api
AFROGATE_AGENT_ID=local-dev-agent
AFROGATE_API_URL=http://127.0.0.1:7000/api
AFROGATE_PUSH_INTERVAL_SECONDS=10
AFROGATE_AGENT_STATE_FILE=
"@ | Set-Content -Path $envPath -Encoding UTF8
  }
}

$previousDatabaseUrl = $env:DATABASE_URL
$env:DATABASE_URL = $databaseUrl

try {
  npm --workspace @afrogate/backend run db:migrate
} finally {
  if ($null -eq $previousDatabaseUrl) {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:DATABASE_URL = $previousDatabaseUrl
  }
}

Write-Host "Local PostgreSQL is ready: $databaseUrl"
