import { spawn } from 'node:child_process';
import { PACKAGE_NAME } from '../constants.js';
import { existsSync } from 'node:fs';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AGENTS_TEMPLATE, APP_SCHEMA_TEMPLATE, createPackageJsonTemplate, DOCKER_COMPOSE_TEMPLATE, ENV_TEMPLATE, GITIGNORE_TEMPLATE, HEALTH_ROUTE_TEMPLATE, MAKEFILE_TEMPLATE, TSCONFIG_TEMPLATE, } from './templates.js';
const INIT_FILES = [
    { relativePath: 'AGENTS.md', content: AGENTS_TEMPLATE },
    { relativePath: 'app.schema', content: APP_SCHEMA_TEMPLATE },
    { relativePath: '.env', content: ENV_TEMPLATE },
    { relativePath: '.gitignore', content: GITIGNORE_TEMPLATE },
    { relativePath: 'docker-compose.yml', content: DOCKER_COMPOSE_TEMPLATE },
    { relativePath: 'Makefile', content: MAKEFILE_TEMPLATE },
    { relativePath: 'tsconfig.json', content: TSCONFIG_TEMPLATE },
    { relativePath: 'src/routes/health.ts', content: HEALTH_ROUTE_TEMPLATE },
];
function resolveTargetDir(args) {
    const targetArg = args.find((arg) => !arg.startsWith('--'));
    return path.resolve(targetArg ?? '.');
}
function resolveProjectName(targetDir) {
    return path.basename(targetDir) || `${PACKAGE_NAME}-app`;
}
function runNpmInstall(cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn('npm', ['install'], {
            cwd,
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`npm install failed with exit code ${code}`));
        });
    });
}
function runGitInit(cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn('git', ['init'], {
            cwd,
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`git init failed with exit code ${code}`));
        });
    });
}
export async function runInit(args) {
    const skipInstall = args.includes('--skip-install');
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
    await mkdir(path.join(targetDir, 'src/hooks'), { recursive: true });
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
    }
    else {
        console.log('Skipped existing file: package.json');
    }
    if (!skipInstall) {
        console.log('\nRunning npm install...');
        await runNpmInstall(targetDir);
    }
    const gitDir = path.join(targetDir, '.git');
    if (existsSync(gitDir)) {
        console.log('\nSkipped git init (already a repository)');
    }
    else {
        console.log('\nRunning git init...');
        await runGitInit(targetDir);
    }
    console.log('\nNext steps:');
    if (targetDir !== process.cwd()) {
        console.log(`  cd ${targetDir}`);
    }
    if (skipInstall) {
        console.log('  npm install');
    }
    console.log('  make dev');
    console.log('');
    console.log('  # or run individually:');
    console.log('  docker compose up -d --wait');
    console.log(`  npx ${PACKAGE_NAME} dev   # generate + bootstrap + server + schema watch`);
    console.log('');
    console.log('  # production:');
    console.log(`  npx ${PACKAGE_NAME} generate`);
    console.log(`  npx ${PACKAGE_NAME} start   # migrate DB + run server`);
    console.log('');
    console.log('  # split dev steps (dev already includes generate, bootstrap, and watch):');
    console.log(`  npx ${PACKAGE_NAME} generate`);
    console.log(`  npx ${PACKAGE_NAME} db:bootstrap`);
    console.log(`  npx ${PACKAGE_NAME} dev --no-watch`);
}
