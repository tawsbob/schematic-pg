/** Demo User requires balance; register bypasses @policy and writes via db.user.create. */
declare const _default: import("hono").Hono<import("../api/types.js").AppEnv, import("hono/types").BlankSchema, "/">;
export default _default;
