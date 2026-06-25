import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseIncludeQuery, validateIncludePaths } from '../include-query.js';

const userTree = {
  profile: {},
  orders: {
    products: {
      product: {},
    },
  },
} as const;

describe('validateIncludePaths', () => {
  it('accepts valid shallow and nested paths', () => {
    assert.equal(validateIncludePaths('profile,orders.products', userTree), undefined);
  });

  it('rejects unknown relations', () => {
    assert.match(
      validateIncludePaths('missing', userTree),
      /Unknown include relation "missing"/,
    );
  });

  it('rejects depth overflow', () => {
    const deepTree = {
      a: {
        b: {
          c: {
            d: {
              e: {
                f: {
                  g: {
                    h: {
                      i: {
                        j: {
                          k: {},
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    assert.match(
      validateIncludePaths('a.b.c.d.e.f.g.h.i.j.k', deepTree),
      /exceeds maximum depth/,
    );
  });

  it('rejects too many comma-separated paths', () => {
    const paths = Array.from({ length: 11 }, (_, index) => `profile${index}`).join(',');
    const tree = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => [`profile${index}`, {}]),
    );

    assert.match(validateIncludePaths(paths, tree), /exceeds maximum of 10 paths/);
  });

  it('rejects empty segments', () => {
    assert.match(validateIncludePaths('profile,,orders', userTree), /empty relation segments/);
  });
});

describe('parseIncludeQuery', () => {
  it('parses shallow includes', () => {
    assert.deepEqual(parseIncludeQuery('profile,orders', userTree), {
      profile: true,
      orders: true,
    });
  });

  it('parses nested includes', () => {
    assert.deepEqual(parseIncludeQuery('orders.products.product', userTree), {
      orders: {
        include: {
          products: {
            include: {
              product: true,
            },
          },
        },
      },
    });
  });

  it('merges overlapping paths', () => {
    assert.deepEqual(parseIncludeQuery('orders,orders.products', userTree), {
      orders: {
        include: {
          products: true,
        },
      },
    });
  });

  it('deduplicates identical paths', () => {
    assert.deepEqual(parseIncludeQuery('orders,orders', userTree), {
      orders: true,
    });
  });

  it('throws for invalid paths', () => {
    assert.throws(() => parseIncludeQuery('missing', userTree), /Unknown include relation/);
  });
});
