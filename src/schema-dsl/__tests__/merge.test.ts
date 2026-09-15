import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mergeFragments,
  parseFragment,
  validateMergedSchema,
  SchemaError,
} from '../index.js';
import { SqlGenerator } from '../../sql-generator/sql-generator.js';

function fragment(file: string, source: string) {
  return { file, source, schema: parseFragment(source, file) };
}

describe('mergeFragments', () => {
  const userFragment = `enums {
  UserRole { ADMIN, USER }
}

models {
  model User {
    id: UUID @id
    role: UserRole
  }
}
`;

  const walletFragment = `extensions {
  pgcrypto
}

models {
  model Wallet {
    id: UUID @id
    userId: UUID
    user: User @relation(fields: [userId], references: [id])
  }
}
`;

  const ledgerFragment = `models {
  model Ledger {
    id: UUID @id
    amount: INTEGER
  }
}

functions {
  function getBalance(userId: UUID): INTEGER {
    language: sql
    execute: """SELECT 1"""
  }
}
`;

  it('sorts declarations by name regardless of fragment order', () => {
    const forward = mergeFragments([
      fragment('schema/user.schema', userFragment),
      fragment('schema/wallet.schema', walletFragment),
      fragment('schema/ledger.schema', ledgerFragment),
    ]);
    const reverse = mergeFragments([
      fragment('schema/ledger.schema', ledgerFragment),
      fragment('schema/wallet.schema', walletFragment),
      fragment('schema/user.schema', userFragment),
    ]);

    assert.deepEqual(
      forward.schema.models.map((model) => model.name),
      ['Ledger', 'User', 'Wallet'],
    );
    assert.deepEqual(
      reverse.schema.models.map((model) => model.name),
      ['Ledger', 'User', 'Wallet'],
    );
    assert.equal(forward.canonicalSource, reverse.canonicalSource);
  });

  it('produces byte-identical SQL regardless of fragment read order', () => {
    const forward = mergeFragments([
      fragment('b.schema', walletFragment),
      fragment('a.schema', userFragment),
      fragment('c.schema', ledgerFragment),
    ]);
    const reverse = mergeFragments([
      fragment('c.schema', ledgerFragment),
      fragment('a.schema', userFragment),
      fragment('b.schema', walletFragment),
    ]);

    validateMergedSchema(forward.schema);
    validateMergedSchema(reverse.schema);

    const generator = new SqlGenerator();
    assert.equal(generator.generate(forward.schema), generator.generate(reverse.schema));
  });

  it('preserves originating file on declaration locs', () => {
    const merged = mergeFragments([
      fragment('schema/user.schema', userFragment),
      fragment('schema/wallet.schema', walletFragment),
    ]);

    const user = merged.schema.models.find((model) => model.name === 'User');
    const wallet = merged.schema.models.find((model) => model.name === 'Wallet');
    assert.equal(user?.loc.file, 'schema/user.schema');
    assert.equal(wallet?.loc.file, 'schema/wallet.schema');
  });

  it('emits a canonical document that omits empty sections', () => {
    const merged = mergeFragments([
      fragment('schema/user.schema', userFragment),
      fragment('schema/wallet.schema', walletFragment),
    ]);

    assert.match(merged.canonicalSource, /^extensions \{/m);
    assert.match(merged.canonicalSource, /^enums \{/m);
    assert.match(merged.canonicalSource, /^models \{/m);
    assert.doesNotMatch(merged.canonicalSource, /^functions \{/m);
    assert.match(merged.canonicalSource, /model User \{/);
    assert.match(merged.canonicalSource, /model Wallet \{/);
    assert.match(merged.canonicalSource, /pgcrypto/);
    assert.match(merged.canonicalSource, /UserRole/);
  });
});

describe('validateMergedSchema', () => {
  it('rejects duplicate model names across fragments', () => {
    const left = fragment('a.schema', `models { model User { id: UUID @id } }`);
    const right = fragment('b.schema', `models { model User { id: UUID @id } }`);
    const { schema } = mergeFragments([left, right]);

    assert.throws(
      () => validateMergedSchema(schema),
      (error: unknown) => {
        assert.ok(error instanceof SchemaError);
        assert.match(error.message, /duplicate model name "User"/);
        assert.match(error.message, /a\.schema/);
        return true;
      },
    );
  });

  it('rejects duplicate enum names across fragments', () => {
    const left = fragment('a.schema', `enums { Status { A } }`);
    const right = fragment('b.schema', `enums { Status { B } }`);
    const { schema } = mergeFragments([left, right]);

    assert.throws(
      () => validateMergedSchema(schema),
      (error: unknown) => {
        assert.ok(error instanceof SchemaError);
        assert.match(error.message, /duplicate enum name "Status"/);
        return true;
      },
    );
  });

  it('rejects unknown type names', () => {
    const schema = parseFragment(
      `models {
  model User {
    id: UUID @id
    status: MisspelledEnum
  }
}`,
      'app.schema',
    );

    assert.throws(
      () => validateMergedSchema(schema),
      (error: unknown) => {
        assert.ok(error instanceof SchemaError);
        assert.match(error.message, /unknown type "MisspelledEnum"/);
        assert.match(error.message, /User\.status/);
        return true;
      },
    );
  });

  it('accepts documented PostgreSQL primitives such as BIGINT', () => {
    const schema = parseFragment(
      `models {
  model Wallet {
    id: UUID @id
    balance: BIGINT @default(0)
  }
}`,
      'app.schema',
    );

    assert.doesNotThrow(() => validateMergedSchema(schema));
  });

  it('allows relation fields that reference other models', () => {
    const { schema } = mergeFragments([
      fragment(
        'user.schema',
        `models {
  model User {
    id: UUID @id
    profile: Profile?
  }
}`,
      ),
      fragment(
        'profile.schema',
        `models {
  model Profile {
    id: UUID @id
    userId: UUID
    user: User @relation(fields: [userId], references: [id])
  }
}`,
      ),
    ]);

    assert.doesNotThrow(() => validateMergedSchema(schema));
  });
});
