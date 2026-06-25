import { PACKAGE_NAME } from '../constants.js';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  APP_SCHEMA_TEMPLATE,
  createPackageJsonTemplate,
  DOCKER_COMPOSE_TEMPLATE,
  ENV_TEMPLATE,
  HEALTH_ROUTE_TEMPLATE,
  TSCONFIG_TEMPLATE,
} from './templates.js';

const INIT_FILES = [
  { relativePath: 'app.schema', content: APP_SCHEMA_TEMPLATE },
  { relativePath: '.env', content: ENV_TEMPLATE },
  { relativePath: 'docker-compose.yml', content: DOCKER_COMPOSE_TEMPLATE },
  { relativePath: 'tsconfig.json', content: TSCONFIG_TEMPLATE },
  { relativePath: 'src/routes/health.ts', content: HEALTH_ROUTE_TEMPLATE },
] as const;

function resolveTargetDir(args: string[]): string {
  const targetArg = args.find((arg) => !arg.startsWith('--'));
  return path.resolve(targetArg ?? '.');
}

function resolveProjectName(targetDir: string): string {
  return path.basename(targetDir) || `${PACKAGE_NAME}-app`;
}

export async function runInit(args: string[]): Promise<void> {
  const targetDir = resolveTargetDir(args);
  const projectName = resolveProjectName(targetDir);

  if (targetDir !== process.cwd() && existsSync(targetDir)) {
    const entries = await readdir(targetDir);
    if (entries.length > 0) {
      throw new Error(`Target directory is not empty: ${targetDir}`);
    }
  }

  await mkdir(targetDir, { recursive: true });
  await mkdir(path.join(targetDir, 'src/routes'), { recursive: true });

  for (const file of INIT_FILES) {
    const filePath = path.join(targetDir, file.relativePath);
    if (existsSync(filePath)) {
      console.log(`Skipped existing file: ${file.relativePath}`);
      continue;
    }

    await writeFile(filePath, file.content, 'utf8');
    console.log(`Created ${file.relativePath}`);
  }

  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    await writeFile(packageJsonPath, `${createPackageJsonTemplate(projectName)}\n`, 'utf8');
    console.log('Created package.json');
  } else {
    console.log('Skipped existing file: package.json');
  }

  console.log('\nNext steps:');
  if (targetDir !== process.cwd()) {
    console.log(`  cd ${targetDir}`);
  }
  console.log('  npm install');
  console.log('  docker compose up -d');
  console.log(`  npx ${PACKAGE_NAME} generate`);
  console.log(`  npx ${PACKAGE_NAME} db:bootstrap`);
  console.log(`  npx ${PACKAGE_NAME} dev`);
}
