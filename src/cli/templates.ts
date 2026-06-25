import { PACKAGE_NAME, PACKAGE_VERSION } from '../constants.js';

export const APP_SCHEMA_TEMPLATE = `models {
  model User {
    id:        UUID        @id @default(gen_random_uuid())
    email:     VARCHAR(255) @unique
    name:      VARCHAR(150)
    createdAt: TIMESTAMP   @default(now())
  }
}
`;

export const ENV_TEMPLATE = `DATABASE_URL=postgresql://postgrest:postgrest@localhost:5432/postgrest
JWT_SECRET=
JWT_ROLE_CLAIM=role
JWT_USER_ID_CLAIM=sub
`;

export const DOCKER_COMPOSE_TEMPLATE = `services:
  postgres:
    image: postgis/postgis:16-3.4
    container_name: schematic-pg-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgrest
      POSTGRES_PASSWORD: postgrest
      POSTGRES_DB: postgrest
    volumes:
      - ./docker_data/postgres:/var/lib/postgresql/data
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

export const HEALTH_ROUTE_TEMPLATE = `import { Hono } from 'hono';
import type { AppEnv } from '${PACKAGE_NAME}/api/types';

const router = new Hono<AppEnv>();
router.get('/', (c) => c.json({ ok: true }));
export default router;
`;

export function createPackageJsonTemplate(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: `${PACKAGE_NAME} dev`,
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
    },
    null,
    2,
  );
}
