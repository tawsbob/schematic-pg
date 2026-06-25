export type PolicyOperation = 'select' | 'insert' | 'update' | 'delete';

export interface NormalizedPolicy {
  role: string;
  operations: PolicyOperation[] | 'all';
  where?: string;
}
