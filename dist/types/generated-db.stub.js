export function createDbClient(_pool) {
    return {
        async $queryRaw() {
            return [];
        },
        async $executeRaw() {
            return 0;
        },
        async $transaction(fn) {
            return fn(this);
        },
    };
}
