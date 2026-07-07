import { spawnSync } from 'child_process';
import * as path from 'path';

const mainPath = path.join(process.cwd(), 'dist', 'main.js');

const result = spawnSync(process.execPath, [mainPath], {
  stdio: 'inherit',
  env: { ...process.env, GENERATE_OPENAPI: 'true' },
});

process.exit(result.status ?? 1);
