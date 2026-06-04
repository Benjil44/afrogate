import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bumpTarget = process.argv[2];

if (!bumpTarget) {
  fail('Usage: npm run version:set -- <patch|minor|major|x.y.z>');
}

const rootPackagePath = path.join(repoRoot, 'package.json');
const rootPackage = readJson(rootPackagePath);
const currentVersion = rootPackage.version;
const nextVersion = resolveNextVersion(currentVersion, bumpTarget);
const workspacePackagePaths = findWorkspacePackages(rootPackage.workspaces ?? []);
const pluginManifestPaths = findPluginManifests();

for (const packagePath of [rootPackagePath, ...workspacePackagePaths]) {
  const packageJson = readJson(packagePath);
  packageJson.version = nextVersion;
  updateInternalDependencies(packageJson, nextVersion);
  writeJson(packagePath, packageJson);
}

for (const pluginManifestPath of pluginManifestPaths) {
  const pluginManifest = readJson(pluginManifestPath);
  pluginManifest.version = nextVersion;
  writeJson(pluginManifestPath, pluginManifest);
}

updatePackageLock(nextVersion);
fs.writeFileSync(path.join(repoRoot, 'VERSION'), `${nextVersion}\n`, 'utf8');

console.log(`Afrows version updated: ${currentVersion} -> ${nextVersion}`);

function resolveNextVersion(version, target) {
  if (/^\d+\.\d+\.\d+$/.test(target)) return target;

  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) fail(`Current version is not SemVer: ${version}`);

  const [, majorValue, minorValue, patchValue] = match;
  let major = Number(majorValue);
  let minor = Number(minorValue);
  let patch = Number(patchValue);

  if (target === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (target === 'minor') {
    minor += 1;
    patch = 0;
  } else if (target === 'patch') {
    patch += 1;
  } else {
    fail(`Unknown version bump target: ${target}`);
  }

  return `${major}.${minor}.${patch}`;
}

function findWorkspacePackages(workspacePatterns) {
  const packagePaths = [];

  for (const pattern of workspacePatterns) {
    if (!pattern.endsWith('/*')) {
      fail(`Unsupported workspace pattern: ${pattern}`);
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

function findPluginManifests() {
  const pluginsRoot = path.join(repoRoot, 'plugins');
  if (!fs.existsSync(pluginsRoot)) return [];

  const manifestPaths = [];

  for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(pluginsRoot, entry.name, '.codex-plugin', 'plugin.json');
    if (fs.existsSync(manifestPath)) manifestPaths.push(manifestPath);
  }

  return manifestPaths.sort();
}

function updateInternalDependencies(packageJson, version) {
  for (const dependencyGroup of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const dependencies = packageJson[dependencyGroup];
    if (!dependencies) continue;

    for (const dependencyName of Object.keys(dependencies)) {
      if (dependencyName.startsWith('@afrows/')) {
        dependencies[dependencyName] = version;
      }
    }
  }
}

function updatePackageLock(version) {
  const lockPath = path.join(repoRoot, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return;

  const packageLock = readJson(lockPath);
  packageLock.version = version;

  if (packageLock.packages) {
    for (const [packagePath, packageData] of Object.entries(packageLock.packages)) {
      if (packagePath === '' || packagePath.startsWith('apps/') || packagePath.startsWith('packages/')) {
        packageData.version = version;
      }

      updateInternalDependencies(packageData, version);
    }
  }

  writeJson(lockPath, packageLock);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
