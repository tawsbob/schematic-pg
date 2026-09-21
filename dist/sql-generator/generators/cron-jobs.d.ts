import type { CronJob, Schema } from '../../schema-dsl/ast.js';
export interface NormalizedCronJob {
    name: string;
    sqlName: string;
    schedule: string;
    command: string;
}
export declare function normalizeCronJob(job: CronJob): NormalizedCronJob;
export declare function formatCronCommandLiteral(command: string): string;
export declare function generateCreateCronJob(normalized: NormalizedCronJob): string;
export declare function generateDropCronJob(jobName: string): string;
export declare function generateCronJobs(schema: Schema): string;
