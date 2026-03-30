#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const action = process.argv[2] || 'up';
const projectRoot = resolve(new URL('..', import.meta.url).pathname);
const runtimeDir = join(projectRoot, 'nginx', '.runtime');
const runtimeLogsDir = join(runtimeDir, 'logs');
const runtimeConfPath = join(runtimeDir, 'default.conf');
const runtimePidPath = join(runtimeDir, 'nginx.pid');
const distDir = join(projectRoot, 'dist');

const port = process.env.PORT || '8080';
const apiRoot = process.env.API_ROOT || 'http://103.235.75.231:3000';

function commandExists(cmd) {
  return spawnSync('sh', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

function runOrExit(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    ...options,
  });

  process.exit(result.status ?? 1);
}

function ensureLocalRuntimeConfig() {
  if (!existsSync(distDir)) {
    console.error('Missing dist/ directory. Run `npm run build` first.');
    process.exit(1);
  }

  mkdirSync(runtimeLogsDir, { recursive: true });

  const config = `
pid ${runtimePidPath};

events {
  worker_connections 1024;
}

http {
  include       mime.types;
  default_type  application/octet-stream;

  access_log ${join(runtimeLogsDir, 'access.log')};
  error_log ${join(runtimeLogsDir, 'error.log')};

  map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
  }

  server {
    listen ${port};
    server_name _;

    root ${distDir};
    index index.html;

    location /api/ {
      proxy_pass ${apiRoot};
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
      try_files $uri $uri/ /index.html;
    }
  }
}
`.trimStart();

  writeFileSync(runtimeConfPath, config, 'utf8');
}

function up() {
  if (commandExists('docker')) {
    runOrExit('docker', ['compose', '-f', 'nginx/docker-compose.yml', 'up', '--build', '-d'], {
      env: { ...process.env, PORT: port, API_ROOT: apiRoot },
    });
  }

  if (commandExists('nginx')) {
    ensureLocalRuntimeConfig();
    runOrExit('nginx', ['-p', runtimeDir, '-c', runtimeConfPath]);
  }

  console.error('Neither `docker` nor `nginx` was found in PATH. Install one of them and retry.');
  process.exit(1);
}

function down() {
  if (commandExists('docker')) {
    runOrExit('docker', ['compose', '-f', 'nginx/docker-compose.yml', 'down']);
  }

  if (!existsSync(runtimePidPath)) {
    console.log('No local nginx runtime pid found. Nothing to stop.');
    process.exit(0);
  }

  const pid = readFileSync(runtimePidPath, 'utf8').trim();
  if (!pid) {
    console.log('Local nginx pid file is empty. Cleaning runtime state.');
    rmSync(runtimeDir, { recursive: true, force: true });
    process.exit(0);
  }

  const killResult = spawnSync('kill', [pid], { stdio: 'inherit' });
  if ((killResult.status ?? 1) !== 0) {
    process.exit(killResult.status ?? 1);
  }

  rmSync(runtimeDir, { recursive: true, force: true });
  console.log('Stopped local nginx runtime.');
}

function logs() {
  if (commandExists('docker')) {
    runOrExit('docker', ['compose', '-f', 'nginx/docker-compose.yml', 'logs', '-f', 'web']);
  }

  const access = join(runtimeLogsDir, 'access.log');
  const error = join(runtimeLogsDir, 'error.log');

  if (!existsSync(access) && !existsSync(error)) {
    console.error('No local nginx logs found. Start nginx first with `npm run nginx:up`.');
    process.exit(1);
  }

  const files = [access, error].filter(existsSync);
  runOrExit('tail', ['-f', ...files]);
}

if (action === 'up') up();
else if (action === 'down') down();
else if (action === 'logs') logs();
else {
  console.error(`Unknown action: ${action}. Use up|down|logs.`);
  process.exit(1);
}
