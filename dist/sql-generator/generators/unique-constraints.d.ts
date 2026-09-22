import { type NormalizedUnique } from '../utils/ast-helpers.js';
export declare function formatTableUniqueConstraint(modelName: string, normalized: NormalizedUnique): string;
export declare function generateAddUniqueConstraint(modelName: string, normalized: NormalizedUnique): string;
export declare function generateDropUniqueConstraint(modelName: string, normalized: NormalizedUnique): string;
