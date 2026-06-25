import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { version } = require('../package.json');
export const PACKAGE_NAME = 'schematic-pg';
export const PACKAGE_VERSION = version;
export const MAX_INCLUDE_DEPTH = 10;
export const MAX_INCLUDE_PATHS = 10;
