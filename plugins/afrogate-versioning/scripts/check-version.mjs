import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rootPackage = readJson(path.join(repoRoot, 'package.json'));
const expectedVersion = rootPackage.version;
const failures = [];

checkVersionFile(expectedVersion);
checkWorkspacePackages(expectedVersion);
checkPackageLock(expectedVersion);
checkChangelog(expectedVersion);

if (failures.length > 0) {
  console.error('AfroGate version check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`AfroGate version check passed: ${expectedVersion}`);

function checkVersionFile(version) {
  const versionPath = path.join(repoRoot, 'VERSION');
  if (!fs.existsSync(versionPath)) {
    failures.push('VERSION file is missing.');
    return;
  }

  const fileVersion = fs.readFileSync(versionPath, 'utf8').trim();
  if (fileVersion !== version) {
    failures.push(`VERSION is ${fileVersion || '<empty>'}, expected ${version}.`);
  }
}

function checkWorkspacePackages(version) {
  const workspacePackagePaths = findWorkspacePackages(rootPackage.workspaces ?? []);

  for (const packagePath of workspacePackagePaths) {
    const relativePath = path.relative(repoRoot, packagePath);
    const packageJson = readJson(packagePath);

    if (packageJson.version !== version) {
      failures.push(`${relativePath} is ${packageJson.version}, expected ${version}.`);
    }

    checkInternalDependencies(packageJson, relativePath, version);
  }
}

function checkPackageLock(version) {
  const lockPath = path.join(repoRoot, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    failures.push('package-lock.json is missing.');
    return;
  }

  const packageLock = readJson(lockPath);
  if (packageLock.version !== version) {
    failures.push(`package-lock.json root version is ${packageLock.version}, expected ${version}.`);
  }

  for (const packagePath of ['', 'apps/backend', 'apps/dashboard', 'packages/shared']) {
    const packageData = packageLock.packages?.[packagePath];
    if (!packageData) {
      failures.push(`package-lock.json missing package entry ${packagePath || '<root>'}.`);
      continue;
    }

    if (packageData.version !== version) {
      failures.push(`package-lock.json ${packagePath || '<root>'} version is ${packageData.version}, expected ${version}.`);
    }

    checkInternalDependencies(packageData, `package-lock.json:${packagePath || '<root>'}`, version);
  }
}

function checkChangelog(version) {
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    failures.push('CHANGELOG.md is missing.');
    return;
  }

  const changelog = fs.readFileSync(changelogPath, 'utf8');
  if (!changelog.includes(`## ${version} - `)) {
    failures.push(`CHANGELOG.md has no section for ${version}.`);
  }
}

function findWorkspacePackages(workspacePatterns) {
  const packagePaths = [];

  for (const pattern of workspacePatterns) {
    if (!pattern.endsWith('/*')) {
      failures.push(`Unsupported workspace pattern: ${pattern}`);
      continue;
    }

    const workspaceRoot = path.join(repoRoot, pattern.slice(0, -2));
    if (!fs.existsSync(workspaceRoot)) continue;

    for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const packagePath = path.join(workspaceRoot, entry.name, 'package.json');
      if (fs.existsSync(packagePath)) packagePaths.push(packagePath);
    }
  }

  return packagePaths.sort();
}

function checkInternalDependencies(packageJson, source, version) {
  for (const dependencyGroup of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const dependencies = packageJson[dependencyGroup];
    if (!dependencies) continue;

    for (const [dependencyName, dependencyVersion] of Object.entries(dependencies)) {
      if (dependencyName.startsWith('@afrogate/') && dependencyVersion !== version) {
        failures.push(`${source} ${dependencyGroup}.${dependencyName} is ${dependencyVersion}, expected ${version}.`);
      }
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
