import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PACKAGE_NAME, PACKAGE_VERSION } from '../constants.js';
const templatesDir = path.dirname(fileURLToPath(import.meta.url));
export const AGENTS_TEMPLATE = readFileSync(path.join(templatesDir, 'templates', 'agents.md'), 'utf8');
export const APP_SCHEMA_TEMPLATE = `extensions {

}

enums {
  UserRole { ADMIN, USER }
}

models {
  model User {
    id:           UUID         @id @default(gen_random_uuid())
    email:        VARCHAR(255) @unique @regex(pattern: "^[\\w.-]+@[\\w.-]+\\.\\w+$", message: "Invalid email address")
    name:         VARCHAR(150)?
    role:         UserRole     @default(USER)
    passwordHash: VARCHAR(255)? @omit @unfilterable
    createdAt:    TIMESTAMP    @default(now())

    @policy(role: USER, allow: [select, update], where: "id = {{auth.user.id}}")
    @policy(role: ADMIN, allow: all)
  }
}
`;
export const ENV_TEMPLATE = `DATABASE_URL=postgresql://postgrest:postgrest@localhost:5432/postgrest
JWT_SECRET=
AUTH_PEPPER=
AUTH_ACCESS_TOKEN_TTL=1h
JWT_ROLE_CLAIM=role
JWT_USER_ID_CLAIM=sub
`;
export const GITIGNORE_TEMPLATE = `node_modules/
dist/
.env
docker_data/
.DS_Store
*.log
npm-debug.log*
`;
export const DOCKER_COMPOSE_TEMPLATE = `services:
  postgres:
    image: postgres:18.4-bookworm
    container_name: schematic-pg
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgrest
      POSTGRES_PASSWORD: postgrest
      POSTGRES_DB: postgrest
    volumes:
      - ./docker_data/postgres:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgrest -d postgrest"]
      interval: 5s
      timeout: 5s
      retries: 5
`;
export const TSCONFIG_TEMPLATE = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["generated/**/*", "src/**/*"]
}
`;
export const MAKEFILE_TEMPLATE = `.PHONY: dev

dev:
\tdocker compose up -d --wait
\tnpx ${PACKAGE_NAME} dev
`;
export const HEALTH_ROUTE_TEMPLATE = `import { Hono } from 'hono';
import type { AppEnv } from '${PACKAGE_NAME}/api/types';

const router = new Hono<AppEnv>();
router.get('/', (c) => c.json({ ok: true }));
export default router;
`;
export const AUTH_ROUTE_TEMPLATE = `import { createAuthRouter } from '${PACKAGE_NAME}/api/auth/routes';

export default createAuthRouter();
`;
export function createPackageJsonTemplate(projectName) {
    return JSON.stringify({
        name: projectName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
            dev: `${PACKAGE_NAME} dev`,
            start: `${PACKAGE_NAME} start`,
            generate: `${PACKAGE_NAME} generate`,
            'db:bootstrap': `${PACKAGE_NAME} db:bootstrap`,
            'db:migrate': `${PACKAGE_NAME} db:migrate`,
        },
        dependencies: {
            '@hono/node-server': '^2.0.6',
            '@hono/zod-validator': '^0.8.0',
            hono: '^4.12.27',
            pg: '^8.22.0',
            [PACKAGE_NAME]: `^${PACKAGE_VERSION}`,
            zod: '^4.4.3',
        },
        devDependencies: {
            '@types/node': '^22.15.21',
            typescript: '^5.8.3',
        },
    }, null, 2);
}
export function createHookFileTemplate(modelName) {
    return `import { defineHooks } from '${PACKAGE_NAME}/api/hooks';
import type { ${modelName}, ${modelName}CreateInput, ${modelName}UpdateInput } from '../../generated/db-types.js';

export default defineHooks<${modelName}, ${modelName}CreateInput, ${modelName}UpdateInput>({
  async beforeCreate(ctx, next) {
    // ctx.data is the create payload (mutable). Call await next() to proceed.
    // Cancel without calling next(): return ctx.abort(422, 'reason');
    await next();
  },

  async afterCreate(ctx) {
    // ctx.result is the created row. Use ctx.db / ctx.auth for side effects.
  },

  async beforeUpdate(ctx, next) {
    // ctx.params — route params (e.g. id). ctx.data — update payload (mutable).
    await next();
  },

  async afterUpdate(ctx) {
    // ctx.result is the updated row.
  },

  async beforeDelete(ctx, next) {
    // ctx.params — route params. No ctx.data on delete.
    await next();
  },

  async afterDelete(ctx) {
    // ctx.result is the deleted row.
  },
});
`;
}
