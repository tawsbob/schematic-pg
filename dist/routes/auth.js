import { createAuthRouter } from 'schematic-pg/api/auth/routes';
/** Demo User requires balance; register bypasses @policy and writes via db.user.create. */
export default createAuthRouter({
    defaultCreateFields: { balance: 0 },
});
