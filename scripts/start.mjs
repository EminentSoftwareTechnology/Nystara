import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
loadEnvConfig(process.cwd(), mode === 'dev');
const result = spawnSync('bash', ['start.sh', mode, '--env-loaded'], {
  stdio: 'inherit', env: process.env,
});
if (result.error) console.error('Unable to start launcher');
process.exit(result.status ?? 1);
