import type { DbClient } from '../../generated/db.js';

export type AppEnv = {
  Variables: {
    db: DbClient;
  };
};
