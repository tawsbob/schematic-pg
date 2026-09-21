import type { CronJob, Schema } from '../../schema-dsl/ast.js';
import { joinSection } from '../utils/format.js';
import { toSnakeCase } from '../utils/snake-case.js';

export interface NormalizedCronJob {
  name: string;
  sqlName: string;
  schedule: string;
  command: string;
}

export function normalizeCronJob(job: CronJob): NormalizedCronJob {
  const sqlName = toSnakeCase(job.name);
  const command =
    job.call !== undefined ? `SELECT ${toSnakeCase(job.call)}()` : job.execute!.trim();

  return {
    name: job.name,
    sqlName,
    schedule: job.schedule,
    command,
  };
}

export function formatCronCommandLiteral(command: string): string {
  let tag = 'cron';
  if (command.includes(`$${tag}$`)) {
    let suffix = 1;
    while (command.includes(`$${tag}${suffix}$`)) {
      suffix += 1;
    }
    tag = `${tag}${suffix}`;
  }
  return `$${tag}$${command}$${tag}$`;
}

export function generateCreateCronJob(normalized: NormalizedCronJob): string {
  const jobNameLiteral = escapeSqlString(normalized.sqlName);
  const scheduleLiteral = escapeSqlString(normalized.schedule);
  const commandLiteral = formatCronCommandLiteral(normalized.command);

  return [
    `SELECT cron.unschedule(jobid)`,
    `FROM cron.job`,
    `WHERE jobname = ${jobNameLiteral};`,
    ``,
    `SELECT cron.schedule(`,
    `  ${jobNameLiteral},`,
    `  ${scheduleLiteral},`,
    `  ${commandLiteral}`,
    `);`,
  ].join('\n');
}

export function generateDropCronJob(jobName: string): string {
  const jobNameLiteral = escapeSqlString(toSnakeCase(jobName));
  return [
    `SELECT cron.unschedule(jobid)`,
    `FROM cron.job`,
    `WHERE jobname = ${jobNameLiteral};`,
  ].join('\n');
}

export function generateCronJobs(schema: Schema): string {
  if (schema.jobs.length === 0) {
    return '';
  }

  const statements = schema.jobs.map((job) => generateCreateCronJob(normalizeCronJob(job)));
  return joinSection('Create cron jobs', statements);
}

function escapeSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
