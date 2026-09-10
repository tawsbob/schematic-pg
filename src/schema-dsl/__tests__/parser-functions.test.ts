import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expectParseError, parseSnippet, wrapFunctions } from './helpers.js';

function parseFunction(body: string) {
  return parseSnippet(wrapFunctions(body)).functions[0];
}

describe('Parser — functions', () => {
  it('defaults to an empty functions list when the section is omitted', () => {
    const schema = parseSnippet('extensions {}\nenums {}\nmodels {}');
    assert.deepEqual(schema.functions, []);
  });

  it('parses an empty functions section', () => {
    const schema = parseSnippet('extensions {}\nenums {}\nmodels {}\nfunctions {}');
    assert.deepEqual(schema.functions, []);
  });

  it('parses a SQL function with params, return type, and execute body', () => {
    const sqlFunction = parseFunction(`
      function getUserBalance(userId: UUID): INTEGER {
        language: sql
        volatility: STABLE
        execute: """
          SELECT balance FROM "user" WHERE id = user_id
        """
      }
    `);

    assert.equal(sqlFunction.kind, 'SqlFunction');
    assert.equal(sqlFunction.name, 'getUserBalance');
    assert.equal(sqlFunction.params.length, 1);
    assert.equal(sqlFunction.params[0].name, 'userId');
    assert.equal(sqlFunction.params[0].type.name, 'UUID');
    assert.equal(sqlFunction.returns.kind, 'TypeExpr');
    if (sqlFunction.returns.kind !== 'TypeExpr') {
      return;
    }
    assert.equal(sqlFunction.returns.name, 'INTEGER');
    assert.equal(sqlFunction.language, 'sql');
    assert.equal(sqlFunction.volatility, 'STABLE');
    assert.equal(sqlFunction.security, undefined);
    assert.match(sqlFunction.execute, /SELECT balance FROM "user" WHERE id = user_id/);
  });

  it('parses a plpgsql trigger function with no params', () => {
    const sqlFunction = parseFunction(`
      function setUpdatedAt(): TRIGGER {
        language: plpgsql
        security: DEFINER
        execute: """
          NEW.updated_at = now();
          RETURN NEW;
        """
      }
    `);

    assert.equal(sqlFunction.params.length, 0);
    assert.equal(sqlFunction.returns.kind, 'TypeExpr');
    if (sqlFunction.returns.kind !== 'TypeExpr') {
      return;
    }
    assert.equal(sqlFunction.returns.name, 'TRIGGER');
    assert.equal(sqlFunction.language, 'plpgsql');
    assert.equal(sqlFunction.security, 'DEFINER');
    assert.match(sqlFunction.execute, /RETURN NEW/);
  });

  it('parses comma-separated function body keys', () => {
    const sqlFunction = parseFunction(`
      function ping(): INTEGER {
        language: sql,
        volatility: STABLE,
        execute: """
          SELECT 1
        """
      }
    `);

    assert.equal(sqlFunction.language, 'sql');
    assert.equal(sqlFunction.volatility, 'STABLE');
    assert.equal(sqlFunction.execute, 'SELECT 1');
  });

  it('defaults language, volatility, and security when omitted', () => {
    const sqlFunction = parseFunction(`
      function ping(): INTEGER {
        execute: """
          SELECT 1
        """
      }
    `);

    assert.equal(sqlFunction.language, undefined);
    assert.equal(sqlFunction.volatility, undefined);
    assert.equal(sqlFunction.security, undefined);
    assert.equal(sqlFunction.execute, 'SELECT 1');
  });

  it('parses multiple params with trailing comma', () => {
    const sqlFunction = parseFunction(`
      function searchProducts(query: TEXT, limit: INTEGER,): JSONB {
        execute: """
          SELECT jsonb_agg(name) FROM product
        """
      }
    `);

    assert.equal(sqlFunction.params.length, 2);
    assert.equal(sqlFunction.params[0].name, 'query');
    assert.equal(sqlFunction.params[1].name, 'limit');
    assert.equal(sqlFunction.params[1].type.name, 'INTEGER');
  });

  it('parses a TABLE return with columns and trailing comma', () => {
    const sqlFunction = parseFunction(`
      function searchProducts(query: TEXT): TABLE(id: UUID, name: TEXT, price: DECIMAL,) {
        language: sql
        volatility: STABLE
        execute: """
          SELECT id, name, price FROM product
          WHERE name ILIKE '%' || query || '%'
        """
      }
    `);

    assert.equal(sqlFunction.returns.kind, 'TableReturn');
    if (sqlFunction.returns.kind !== 'TableReturn') {
      return;
    }
    assert.equal(sqlFunction.returns.columns.length, 3);
    assert.equal(sqlFunction.returns.columns[0].name, 'id');
    assert.equal(sqlFunction.returns.columns[0].type.name, 'UUID');
    assert.equal(sqlFunction.returns.columns[1].name, 'name');
    assert.equal(sqlFunction.returns.columns[2].name, 'price');
    assert.equal(sqlFunction.returns.columns[2].type.name, 'DECIMAL');
  });

  it('throws when TABLE has no columns', () => {
    expectParseError(
      wrapFunctions(`function search(): TABLE() { execute: """SELECT 1""" }`),
      /at least one TABLE column/,
    );
  });

  it('throws when TABLE is missing a column list', () => {
    expectParseError(
      wrapFunctions(`function search(): TABLE { execute: """SELECT 1""" }`),
      /TABLE column list/,
    );
  });

  it('throws when TABLE column names are duplicated', () => {
    expectParseError(
      wrapFunctions(
        `function search(): TABLE(id: UUID, id: TEXT) { execute: """SELECT 1""" }`,
      ),
      /already defined/,
    );
  });

  it('throws when a TABLE column name collides with a parameter', () => {
    expectParseError(
      wrapFunctions(
        `function search(query: TEXT): TABLE(query: TEXT) { execute: """SELECT 1""" }`,
      ),
      /distinct from parameter/,
    );
  });

  it('throws when execute is missing', () => {
    expectParseError(
      wrapFunctions(`function ping(): INTEGER { language: sql }`),
      /execute/,
    );
  });

  it('throws when execute is not a triple-quoted string', () => {
    expectParseError(
      wrapFunctions(`function ping(): INTEGER { execute: "SELECT 1" }`),
      /triple-quoted execute body/,
    );
  });

  it('throws when language is invalid', () => {
    expectParseError(
      wrapFunctions(`function ping(): INTEGER { language: python, execute: """SELECT 1""" }`),
      /sql.*plpgsql/,
    );
  });

  it('throws when a function name is duplicated', () => {
    expectParseError(
      wrapFunctions(`
        function ping(): INTEGER { execute: """SELECT 1""" }
        function ping(): INTEGER { execute: """SELECT 2""" }
      `),
      /already defined/,
    );
  });
});
