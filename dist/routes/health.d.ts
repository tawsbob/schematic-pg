import { Hono } from 'hono';
import type { AppEnv } from 'schematic-pg/api/types';
declare const router: Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export default router;
