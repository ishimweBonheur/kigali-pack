/**
 * Generates TypeScript SDK types from the OpenAPI spec.
 * Run: npm run openapi:export && npm run sdk:generate
 */
import * as fs from 'fs';
import * as path from 'path';

const OPENAPI_PATH = path.join(process.cwd(), 'openapi', 'openapi.json');
const SDK_DIR = path.join(process.cwd(), 'packages', 'sdk');
const OUTPUT_FILE = path.join(SDK_DIR, 'src', 'types.ts');

interface OpenApiSpec {
  info: { title: string; version: string };
  paths: Record<string, Record<string, { operationId?: string; summary?: string; tags?: string[] }>>;
}

function generateSdkTypes(spec: OpenApiSpec): string {
  const operations: string[] = [];

  for (const [route, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation || typeof operation !== 'object') continue;
      const opId =
        operation.operationId ??
        `${method}${route.replace(/[^a-zA-Z0-9]/g, '_')}`;
      operations.push(
        `  /** ${operation.summary ?? route} */\n  '${opId}': { method: '${method.toUpperCase()}'; path: '${route}' };`,
      );
    }
  }

  return `/**
 * Auto-generated from OpenAPI spec — do not edit manually.
 * Package: @kigali-pack/sdk
 * Run \`npm run sdk:generate\` to regenerate.
 */
export const SDK_VERSION = '${spec.info.version}';
export const SDK_TITLE = '${spec.info.title}';

export type ApiOperation = {
${operations.join('\n')}
};

export type ApiOperationId = keyof ApiOperation;

export interface KigaliPackClientConfig {
  baseUrl?: string;
  apiKey?: string;
  accessToken?: string;
}

export class KigaliPackClient {
  constructor(private readonly config: KigaliPackClientConfig = {}) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) {
      headers['Authorization'] = \`Bearer \${this.config.apiKey}\`;
    } else if (this.config.accessToken) {
      headers['Authorization'] = \`Bearer \${this.config.accessToken}\`;
    }
    return headers;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const baseUrl = this.config.baseUrl ?? 'http://localhost:3000';
    const response = await fetch(\`\${baseUrl}\${path}\`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(\`Kigali-Pack API error: \${response.status} \${response.statusText}\`);
    }
    return response.json() as Promise<T>;
  }
}
`;
}

function main() {
  if (!fs.existsSync(OPENAPI_PATH)) {
    console.error(
      'OpenAPI spec not found. Run: npm run openapi:export first.',
    );
    process.exit(1);
  }

  const spec = JSON.parse(
    fs.readFileSync(OPENAPI_PATH, 'utf-8'),
  ) as OpenApiSpec;

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, generateSdkTypes(spec));

  const packageJson = {
    name: '@kigali-pack/sdk',
    version: spec.info.version,
    description: 'TypeScript SDK for Kigali-Pack Cloud Engine',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
    },
    files: ['dist'],
    license: 'UNLICENSED',
  };

  fs.writeFileSync(
    path.join(SDK_DIR, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  );

  fs.writeFileSync(
    path.join(SDK_DIR, 'src', 'index.ts'),
    "export * from './types';\n",
  );

  fs.writeFileSync(
    path.join(SDK_DIR, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          declaration: true,
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
        },
        include: ['src/**/*'],
      },
      null,
      2,
    ),
  );

  console.log(`SDK generated at ${SDK_DIR}`);
}

main();
