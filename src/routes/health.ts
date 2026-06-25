import { Hono } from 'hono';
import type { AppEnv } from 'schematic-pg/api/types';

const router = new Hono<AppEnv>();
router.get('/', (c) => c.json({ ok: true }));
export default router;
