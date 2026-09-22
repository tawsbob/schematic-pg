import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { loadRepoSchema } from '../../__tests__/helpers/repo-schema.js';
import { parse } from '../../schema-dsl/index.js';
import { wrapFunctions, wrapModels } from '../../schema-dsl/__tests__/helpers.js';
import { SqlGenerator } from '../sql-generator.js';

const fixturePath = join(process.cwd(), 'src/sql-generator/__tests__/fixtures/app.schema.sql');

describe('SqlGenerator — app.schema', () => {
  const { schema } = loadRepoSchema();
  const sql = new SqlGenerator().generate(schema);
  const expected = readFileSync(fixturePath, 'utf8');

  it('matches the golden SQL fixture', () => {
    assert.equal(sql, expected);
  });

  it('includes all generation sections', () => {
    for (const header of [
      '-- Extensions',
      '-- Enums',
      '-- Drop tables',
      '-- Create tables',
      '-- Create indexes',
      '-- Alter tables (foreign keys)',
      '-- Create functions',
      '-- Create triggers',
    ]) {
      assert.ok(sql.includes(header), `missing section ${header}`);
    }
  });

  it('emits indexes before foreign keys', () => {
    const indexesHeader = sql.indexOf('-- Create indexes');
    const foreignKeysHeader = sql.indexOf('-- Alter tables (foreign keys)');
    assert.ok(indexesHeader >= 0);
    assert.ok(foreignKeysHeader >= 0);
    assert.ok(indexesHeader < foreignKeysHeader);
  });

  it('generates extensions, enums, tables, foreign keys, indexes, and triggers', () => {
    assert.match(sql, /CREATE EXTENSION IF NOT EXISTS "pgcrypto"/);
    assert.match(sql, /CREATE TYPE user_role AS ENUM/);
    assert.match(sql, /CREATE TABLE "user"/);
    assert.match(sql, /CREATE TABLE profile/);
    assert.match(sql, /CREATE TABLE "order"/);
    assert.match(sql, /CREATE TABLE log/);
    assert.match(sql, /CREATE TABLE product/);
    assert.match(sql, /CREATE TABLE product_order/);
    assert.match(sql, /ALTER TABLE profile ADD CONSTRAINT profile_user_id_fkey/);
    assert.match(sql, /ALTER TABLE "order" ADD CONSTRAINT order_user_id_fkey/);
    assert.match(sql, /CREATE INDEX user_role_is_active_idx/);
    assert.match(sql, /CREATE UNIQUE INDEX user_email_idx/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION get_user_balance\(user_id UUID\)/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION user_before_update_trigger_func/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION product_after_update_trigger_func/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION product_before_update_trigger_func/);
  });

  it('comments out validation attributes', () => {
    assert.match(sql, /-- @regex: pattern =/);
    assert.match(sql, /-- @range: min = 1, max = 120/);
  });

  it('emits composite UNIQUE constraints from @@unique', () => {
    const uniqueSchema = parse(
      wrapModels(`model RecipeIngredient {
        id: UUID @id
        recipeId: UUID
        stockItemId: UUID
        @@unique(fields: [recipeId, stockItemId])
        @@unique(fields: [recipeId, id], name: "custom_recipe_id_key")
      }`),
    );
    const generated = new SqlGenerator().generate(uniqueSchema);

    assert.match(
      generated,
      /CONSTRAINT recipe_ingredient_recipe_id_stock_item_id_key UNIQUE \(recipe_id, stock_item_id\)/,
    );
    assert.match(
      generated,
      /CONSTRAINT custom_recipe_id_key UNIQUE \(recipe_id, id\)/,
    );
  });

  it('generates SQL functions with snake_case names and plpgsql wrapping', () => {
    const schema = parse(
      wrapFunctions(`
        function getUserBalance(userId: UUID): INTEGER {
          language: sql
          volatility: STABLE
          execute: """
            SELECT balance FROM "user" WHERE id = user_id
          """
        }

        function setUpdatedAt(): TRIGGER {
          language: plpgsql
          execute: """
            NEW.updated_at = now();
            RETURN NEW;
          """
        }
      `),
    );
    const sql = new SqlGenerator().generate(schema);

    assert.match(sql, /CREATE OR REPLACE FUNCTION get_user_balance\(user_id UUID\)/);
    assert.match(sql, /RETURNS INTEGER/);
    assert.match(sql, /LANGUAGE sql/);
    assert.match(sql, /STABLE/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION set_updated_at\(\)/);
    assert.match(sql, /RETURNS TRIGGER/);
    assert.match(sql, /LANGUAGE plpgsql/);
    assert.match(sql, /BEGIN\n {2}NEW\.updated_at = now\(\);/);
    assert.match(sql, /END;/);
  });

  it('generates RETURNS TABLE with snake_case column names', () => {
    const schema = parse(
      wrapFunctions(`
        function searchProducts(query: TEXT): TABLE(id: UUID, productName: TEXT, price: DECIMAL) {
          language: sql
          volatility: STABLE
          execute: """
            SELECT id, name, price FROM product
            WHERE name ILIKE '%' || query || '%'
          """
        }
      `),
    );
    const sql = new SqlGenerator().generate(schema);

    assert.match(sql, /CREATE OR REPLACE FUNCTION search_products\(query TEXT\)/);
    assert.match(
      sql,
      /RETURNS TABLE \(id UUID, product_name TEXT, price DECIMAL\)/,
    );
    assert.match(sql, /LANGUAGE sql/);
    assert.match(sql, /STABLE/);
  });

  it('omits the cron jobs section when no jobs are declared', () => {
    assert.doesNotMatch(sql, /-- Create cron jobs/);
  });

  it('generates pg_cron extension without WITH SCHEMA public', () => {
    const schema = parse(`extensions { pg_cron }\nmodels {}`);
    const generated = new SqlGenerator().generate(schema);
    assert.match(generated, /CREATE EXTENSION IF NOT EXISTS "pg_cron";/);
    assert.doesNotMatch(generated, /"pg_cron" WITH SCHEMA public/);
  });

  it('generates cron jobs with unschedule then schedule', () => {
    const schema = parse(`extensions { pg_cron }
functions {
  function expireSessions(): VOID {
    execute: """SELECT 1"""
  }
}
cron {
  job expireSessions {
    schedule: "0 * * * *"
    call: expireSessions
  }
  job nightlyVacuum {
    schedule: "0 3 * * *"
    execute: "VACUUM ANALYZE"
  }
}`);
    const generated = new SqlGenerator().generate(schema);

    assert.match(generated, /-- Create cron jobs/);
    assert.match(generated, /WHERE jobname = 'expire_sessions'/);
    assert.match(
      generated,
      /SELECT cron\.schedule\(\s*'expire_sessions',\s*'0 \* \* \* \*',\s*\$cron\$SELECT expire_sessions\(\)\$cron\$/s,
    );
    assert.match(
      generated,
      /SELECT cron\.schedule\(\s*'nightly_vacuum',\s*'0 3 \* \* \*',\s*\$cron\$VACUUM ANALYZE\$cron\$/s,
    );

    const functionsHeader = generated.indexOf('-- Create functions');
    const cronHeader = generated.indexOf('-- Create cron jobs');
    assert.ok(functionsHeader >= 0);
    assert.ok(cronHeader > functionsHeader);
  });
});
