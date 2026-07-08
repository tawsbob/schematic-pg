const BEGIN = 'BEGIN';
const COMMIT = 'COMMIT';
const ROLLBACK = 'ROLLBACK';
export async function runInTransaction(pool, fn) {
    const client = await pool.connect();
    try {
        await client.query(BEGIN);
        const result = await fn(client);
        await client.query(COMMIT);
        return result;
    }
    catch (error) {
        try {
            await client.query(ROLLBACK);
        }
        catch {
            // ignore rollback failure; surface the original error
        }
        throw error;
    }
    finally {
        client.release();
    }
}
