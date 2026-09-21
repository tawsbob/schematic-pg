// Auto-generated model metadata. Do not edit manually.
import type { ModelMetaSnapshot } from 'schematic-pg/db/model-meta';

export const announcementModelMeta = {
  "name": "Announcement",
  "tableName": "announcement",
  "quotedTableName": "announcement",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 62,
          "col": 14,
          "endLine": 62,
          "endCol": 18,
          "start": 1217,
          "end": 1221
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "teamId",
      "columnName": "team_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 63,
          "col": 14,
          "endLine": 63,
          "endCol": 18,
          "start": 1267,
          "end": 1271
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "message",
      "columnName": "message",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 64,
          "col": 14,
          "endLine": 64,
          "endCol": 18,
          "start": 1285,
          "end": 1289
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 62,
          "col": 14,
          "endLine": 62,
          "endCol": 18,
          "start": 1217,
          "end": 1221
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "teamId": {
      "name": "teamId",
      "columnName": "team_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 63,
          "col": 14,
          "endLine": 63,
          "endCol": 18,
          "start": 1267,
          "end": 1271
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "message": {
      "name": "message",
      "columnName": "message",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 64,
          "col": 14,
          "endLine": 64,
          "endCol": 18,
          "start": 1285,
          "end": 1289
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "team_id": "teamId",
    "message": "message"
  },
  "relations": [
    {
      "name": "team",
      "kind": "belongsTo",
      "targetModel": "Team",
      "localKey": "teamId",
      "foreignKey": "id",
      "unique": true
    }
  ]
} as const;
export const logModelMeta = {
  "name": "Log",
  "tableName": "log",
  "quotedTableName": "log",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 3,
          "col": 16,
          "endLine": 3,
          "endCol": 20,
          "start": 38,
          "end": 42
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "message",
      "columnName": "message",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 4,
          "col": 16,
          "endLine": 4,
          "endCol": 20,
          "start": 95,
          "end": 99
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 5,
          "col": 16,
          "endLine": 5,
          "endCol": 25,
          "start": 115,
          "end": 124
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 3,
          "col": 16,
          "endLine": 3,
          "endCol": 20,
          "start": 38,
          "end": 42
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "message": {
      "name": "message",
      "columnName": "message",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 4,
          "col": 16,
          "endLine": 4,
          "endCol": 20,
          "start": 95,
          "end": 99
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "createdAt": {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 5,
          "col": 16,
          "endLine": 5,
          "endCol": 25,
          "start": 115,
          "end": 124
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "message": "message",
    "created_at": "createdAt"
  },
  "relations": []
} as const;
export const noteModelMeta = {
  "name": "Note",
  "tableName": "note",
  "quotedTableName": "note",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 35,
          "col": 13,
          "endLine": 35,
          "endCol": 17,
          "start": 659,
          "end": 663
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "teamId",
      "columnName": "team_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 36,
          "col": 13,
          "endLine": 36,
          "endCol": 17,
          "start": 716,
          "end": 720
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "title",
      "columnName": "title",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 37,
          "col": 13,
          "endLine": 37,
          "endCol": 25,
          "start": 733,
          "end": 745
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "body",
      "columnName": "body",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 38,
          "col": 13,
          "endLine": 38,
          "endCol": 17,
          "start": 758,
          "end": 762
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 35,
          "col": 13,
          "endLine": 35,
          "endCol": 17,
          "start": 659,
          "end": 663
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "teamId": {
      "name": "teamId",
      "columnName": "team_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 36,
          "col": 13,
          "endLine": 36,
          "endCol": 17,
          "start": 716,
          "end": 720
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "title": {
      "name": "title",
      "columnName": "title",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 37,
          "col": 13,
          "endLine": 37,
          "endCol": 25,
          "start": 733,
          "end": 745
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "body": {
      "name": "body",
      "columnName": "body",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 38,
          "col": 13,
          "endLine": 38,
          "endCol": 17,
          "start": 758,
          "end": 762
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "team_id": "teamId",
    "title": "title",
    "body": "body"
  },
  "relations": [
    {
      "name": "team",
      "kind": "belongsTo",
      "targetModel": "Team",
      "localKey": "teamId",
      "foreignKey": "id",
      "unique": true
    }
  ]
} as const;
export const orderModelMeta = {
  "name": "Order",
  "tableName": "order",
  "quotedTableName": "\"order\"",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 7,
          "col": 18,
          "endLine": 7,
          "endCol": 22,
          "start": 122,
          "end": 126
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "userId",
      "columnName": "user_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 8,
          "col": 18,
          "endLine": 8,
          "endCol": 22,
          "start": 183,
          "end": 187
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "status",
      "columnName": "status",
      "type": {
        "kind": "TypeExpr",
        "name": "OrderStatus",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 9,
          "col": 18,
          "endLine": 9,
          "endCol": 29,
          "start": 205,
          "end": 216
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": true,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "totalAmount",
      "columnName": "total_amount",
      "type": {
        "kind": "TypeExpr",
        "name": "DECIMAL",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 10
          },
          {
            "kind": "NumberLiteral",
            "value": 2
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 10,
          "col": 18,
          "endLine": 10,
          "endCol": 32,
          "start": 252,
          "end": 266
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "items",
      "columnName": "items",
      "type": {
        "kind": "TypeExpr",
        "name": "JSONB",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 11,
          "col": 18,
          "endLine": 11,
          "endCol": 23,
          "start": 284,
          "end": 289
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 12,
          "col": 18,
          "endLine": 12,
          "endCol": 27,
          "start": 307,
          "end": 316
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "updatedAt",
      "columnName": "updated_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 13,
          "col": 18,
          "endLine": 13,
          "endCol": 28,
          "start": 352,
          "end": 362
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 7,
          "col": 18,
          "endLine": 7,
          "endCol": 22,
          "start": 122,
          "end": 126
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "userId": {
      "name": "userId",
      "columnName": "user_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 8,
          "col": 18,
          "endLine": 8,
          "endCol": 22,
          "start": 183,
          "end": 187
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "status": {
      "name": "status",
      "columnName": "status",
      "type": {
        "kind": "TypeExpr",
        "name": "OrderStatus",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 9,
          "col": 18,
          "endLine": 9,
          "endCol": 29,
          "start": 205,
          "end": 216
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": true,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "totalAmount": {
      "name": "totalAmount",
      "columnName": "total_amount",
      "type": {
        "kind": "TypeExpr",
        "name": "DECIMAL",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 10
          },
          {
            "kind": "NumberLiteral",
            "value": 2
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 10,
          "col": 18,
          "endLine": 10,
          "endCol": 32,
          "start": 252,
          "end": 266
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    "items": {
      "name": "items",
      "columnName": "items",
      "type": {
        "kind": "TypeExpr",
        "name": "JSONB",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 11,
          "col": 18,
          "endLine": 11,
          "endCol": 23,
          "start": 284,
          "end": 289
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    "createdAt": {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 12,
          "col": 18,
          "endLine": 12,
          "endCol": 27,
          "start": 307,
          "end": 316
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    "updatedAt": {
      "name": "updatedAt",
      "columnName": "updated_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 13,
          "col": 18,
          "endLine": 13,
          "endCol": 28,
          "start": 352,
          "end": 362
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "user_id": "userId",
    "status": "status",
    "total_amount": "totalAmount",
    "items": "items",
    "created_at": "createdAt",
    "updated_at": "updatedAt"
  },
  "relations": [
    {
      "name": "user",
      "kind": "belongsTo",
      "targetModel": "User",
      "localKey": "userId",
      "foreignKey": "id",
      "unique": true
    },
    {
      "name": "products",
      "kind": "hasMany",
      "targetModel": "ProductOrder",
      "localKey": "id",
      "foreignKey": "orderId",
      "unique": false
    }
  ]
} as const;
export const productModelMeta = {
  "name": "Product",
  "tableName": "product",
  "quotedTableName": "product",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 9,
          "col": 18,
          "endLine": 9,
          "endCol": 22,
          "start": 181,
          "end": 185
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "name",
      "columnName": "name",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 10,
          "col": 18,
          "endLine": 10,
          "endCol": 30,
          "start": 242,
          "end": 254
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "description",
      "columnName": "description",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 11,
          "col": 18,
          "endLine": 11,
          "endCol": 22,
          "start": 272,
          "end": 276
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "price",
      "columnName": "price",
      "type": {
        "kind": "TypeExpr",
        "name": "DECIMAL",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 10
          },
          {
            "kind": "NumberLiteral",
            "value": 2
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 12,
          "col": 18,
          "endLine": 12,
          "endCol": 32,
          "start": 294,
          "end": 308
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "stock",
      "columnName": "stock",
      "type": {
        "kind": "TypeExpr",
        "name": "INTEGER",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 13,
          "col": 18,
          "endLine": 13,
          "endCol": 25,
          "start": 326,
          "end": 333
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "category",
      "columnName": "category",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 100
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 14,
          "col": 18,
          "endLine": 14,
          "endCol": 30,
          "start": 351,
          "end": 363
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "tags",
      "columnName": "tags",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "array": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 15,
          "col": 18,
          "endLine": 15,
          "endCol": 24,
          "start": 381,
          "end": 387
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "metadata",
      "columnName": "metadata",
      "type": {
        "kind": "TypeExpr",
        "name": "JSONB",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 16,
          "col": 18,
          "endLine": 16,
          "endCol": 23,
          "start": 405,
          "end": 410
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 17,
          "col": 18,
          "endLine": 17,
          "endCol": 27,
          "start": 448,
          "end": 457
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "updatedAt",
      "columnName": "updated_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 18,
          "col": 18,
          "endLine": 18,
          "endCol": 28,
          "start": 493,
          "end": 503
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 9,
          "col": 18,
          "endLine": 9,
          "endCol": 22,
          "start": 181,
          "end": 185
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "name": {
      "name": "name",
      "columnName": "name",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 10,
          "col": 18,
          "endLine": 10,
          "endCol": 30,
          "start": 242,
          "end": 254
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "description": {
      "name": "description",
      "columnName": "description",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 11,
          "col": 18,
          "endLine": 11,
          "endCol": 22,
          "start": 272,
          "end": 276
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "price": {
      "name": "price",
      "columnName": "price",
      "type": {
        "kind": "TypeExpr",
        "name": "DECIMAL",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 10
          },
          {
            "kind": "NumberLiteral",
            "value": 2
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 12,
          "col": 18,
          "endLine": 12,
          "endCol": 32,
          "start": 294,
          "end": 308
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    "stock": {
      "name": "stock",
      "columnName": "stock",
      "type": {
        "kind": "TypeExpr",
        "name": "INTEGER",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 13,
          "col": 18,
          "endLine": 13,
          "endCol": 25,
          "start": 326,
          "end": 333
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    "category": {
      "name": "category",
      "columnName": "category",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 100
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 14,
          "col": 18,
          "endLine": 14,
          "endCol": 30,
          "start": 351,
          "end": 363
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "tags": {
      "name": "tags",
      "columnName": "tags",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "array": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 15,
          "col": 18,
          "endLine": 15,
          "endCol": 24,
          "start": 381,
          "end": 387
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "metadata": {
      "name": "metadata",
      "columnName": "metadata",
      "type": {
        "kind": "TypeExpr",
        "name": "JSONB",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 16,
          "col": 18,
          "endLine": 16,
          "endCol": 23,
          "start": 405,
          "end": 410
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    "createdAt": {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 17,
          "col": 18,
          "endLine": 17,
          "endCol": 27,
          "start": 448,
          "end": 457
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    "updatedAt": {
      "name": "updatedAt",
      "columnName": "updated_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/product.schema",
          "line": 18,
          "col": 18,
          "endLine": 18,
          "endCol": 28,
          "start": 493,
          "end": 503
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "name": "name",
    "description": "description",
    "price": "price",
    "stock": "stock",
    "category": "category",
    "tags": "tags",
    "metadata": "metadata",
    "created_at": "createdAt",
    "updated_at": "updatedAt"
  },
  "relations": [
    {
      "name": "orders",
      "kind": "hasMany",
      "targetModel": "ProductOrder",
      "localKey": "id",
      "foreignKey": "productId",
      "unique": false
    }
  ]
} as const;
export const productOrderModelMeta = {
  "name": "ProductOrder",
  "tableName": "product_order",
  "quotedTableName": "product_order",
  "primaryKeyFields": [
    "orderId",
    "productId"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "SERIAL",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 23,
          "col": 16,
          "endLine": 23,
          "endCol": 22,
          "start": 620,
          "end": 626
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "orderId",
      "columnName": "order_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 24,
          "col": 16,
          "endLine": 24,
          "endCol": 20,
          "start": 642,
          "end": 646
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": true,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "productId",
      "columnName": "product_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 25,
          "col": 16,
          "endLine": 25,
          "endCol": 20,
          "start": 662,
          "end": 666
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": true,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "quantity",
      "columnName": "quantity",
      "type": {
        "kind": "TypeExpr",
        "name": "INTEGER",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 26,
          "col": 16,
          "endLine": 26,
          "endCol": 23,
          "start": 682,
          "end": 689
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "price",
      "columnName": "price",
      "type": {
        "kind": "TypeExpr",
        "name": "DECIMAL",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 10
          },
          {
            "kind": "NumberLiteral",
            "value": 2
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 27,
          "col": 16,
          "endLine": 27,
          "endCol": 30,
          "start": 705,
          "end": 719
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "SERIAL",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 23,
          "col": 16,
          "endLine": 23,
          "endCol": 22,
          "start": 620,
          "end": 626
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    "orderId": {
      "name": "orderId",
      "columnName": "order_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 24,
          "col": 16,
          "endLine": 24,
          "endCol": 20,
          "start": 642,
          "end": 646
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": true,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "productId": {
      "name": "productId",
      "columnName": "product_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 25,
          "col": 16,
          "endLine": 25,
          "endCol": 20,
          "start": 662,
          "end": 666
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": true,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "quantity": {
      "name": "quantity",
      "columnName": "quantity",
      "type": {
        "kind": "TypeExpr",
        "name": "INTEGER",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 26,
          "col": 16,
          "endLine": 26,
          "endCol": 23,
          "start": 682,
          "end": 689
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    "price": {
      "name": "price",
      "columnName": "price",
      "type": {
        "kind": "TypeExpr",
        "name": "DECIMAL",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 10
          },
          {
            "kind": "NumberLiteral",
            "value": 2
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/order.schema",
          "line": 27,
          "col": 16,
          "endLine": 27,
          "endCol": 30,
          "start": 705,
          "end": 719
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "order_id": "orderId",
    "product_id": "productId",
    "quantity": "quantity",
    "price": "price"
  },
  "relations": [
    {
      "name": "order",
      "kind": "belongsTo",
      "targetModel": "Order",
      "localKey": "orderId",
      "foreignKey": "id",
      "unique": true
    },
    {
      "name": "product",
      "kind": "belongsTo",
      "targetModel": "Product",
      "localKey": "productId",
      "foreignKey": "id",
      "unique": true
    }
  ]
} as const;
export const profileModelMeta = {
  "name": "Profile",
  "tableName": "profile",
  "quotedTableName": "profile",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 44,
          "col": 15,
          "endLine": 44,
          "endCol": 19,
          "start": 1371,
          "end": 1375
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "userId",
      "columnName": "user_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 45,
          "col": 15,
          "endLine": 45,
          "endCol": 19,
          "start": 1429,
          "end": 1433
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "bio",
      "columnName": "bio",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 46,
          "col": 15,
          "endLine": 46,
          "endCol": 19,
          "start": 1463,
          "end": 1467
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "avatar",
      "columnName": "avatar",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 47,
          "col": 15,
          "endLine": 47,
          "endCol": 27,
          "start": 1482,
          "end": 1494
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "location",
      "columnName": "location",
      "type": {
        "kind": "TypeExpr",
        "name": "POINT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 48,
          "col": 15,
          "endLine": 48,
          "endCol": 20,
          "start": 1509,
          "end": 1514
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 44,
          "col": 15,
          "endLine": 44,
          "endCol": 19,
          "start": 1371,
          "end": 1375
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "userId": {
      "name": "userId",
      "columnName": "user_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 45,
          "col": 15,
          "endLine": 45,
          "endCol": 19,
          "start": 1429,
          "end": 1433
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "bio": {
      "name": "bio",
      "columnName": "bio",
      "type": {
        "kind": "TypeExpr",
        "name": "TEXT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 46,
          "col": 15,
          "endLine": 46,
          "endCol": 19,
          "start": 1463,
          "end": 1467
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "avatar": {
      "name": "avatar",
      "columnName": "avatar",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 47,
          "col": 15,
          "endLine": 47,
          "endCol": 27,
          "start": 1482,
          "end": 1494
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "location": {
      "name": "location",
      "columnName": "location",
      "type": {
        "kind": "TypeExpr",
        "name": "POINT",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 48,
          "col": 15,
          "endLine": 48,
          "endCol": 20,
          "start": 1509,
          "end": 1514
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "user_id": "userId",
    "bio": "bio",
    "avatar": "avatar",
    "location": "location"
  },
  "relations": [
    {
      "name": "user",
      "kind": "belongsTo",
      "targetModel": "User",
      "localKey": "userId",
      "foreignKey": "id",
      "unique": true
    }
  ]
} as const;
export const teamModelMeta = {
  "name": "Team",
  "tableName": "team",
  "quotedTableName": "team",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 3,
          "col": 14,
          "endLine": 3,
          "endCol": 18,
          "start": 37,
          "end": 41
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "name",
      "columnName": "name",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 100
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 4,
          "col": 14,
          "endLine": 4,
          "endCol": 26,
          "start": 95,
          "end": 107
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 3,
          "col": 14,
          "endLine": 3,
          "endCol": 18,
          "start": 37,
          "end": 41
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "name": {
      "name": "name",
      "columnName": "name",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 100
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 4,
          "col": 14,
          "endLine": 4,
          "endCol": 26,
          "start": 95,
          "end": 107
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "name": "name"
  },
  "relations": [
    {
      "name": "members",
      "kind": "hasMany",
      "targetModel": "TeamMember",
      "localKey": "id",
      "foreignKey": "teamId",
      "unique": false
    },
    {
      "name": "notes",
      "kind": "hasMany",
      "targetModel": "Note",
      "localKey": "id",
      "foreignKey": "teamId",
      "unique": false
    },
    {
      "name": "announcements",
      "kind": "hasMany",
      "targetModel": "Announcement",
      "localKey": "id",
      "foreignKey": "teamId",
      "unique": false
    }
  ]
} as const;
export const teamMemberModelMeta = {
  "name": "TeamMember",
  "tableName": "team_member",
  "quotedTableName": "team_member",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 14,
          "col": 15,
          "endLine": 14,
          "endCol": 19,
          "start": 247,
          "end": 251
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "teamId",
      "columnName": "team_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 15,
          "col": 15,
          "endLine": 15,
          "endCol": 19,
          "start": 301,
          "end": 305
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "userId",
      "columnName": "user_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 16,
          "col": 15,
          "endLine": 16,
          "endCol": 19,
          "start": 320,
          "end": 324
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "isActive",
      "columnName": "is_active",
      "type": {
        "kind": "TypeExpr",
        "name": "BOOLEAN",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 17,
          "col": 15,
          "endLine": 17,
          "endCol": 22,
          "start": 339,
          "end": 346
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": true
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 14,
          "col": 15,
          "endLine": 14,
          "endCol": 19,
          "start": 247,
          "end": 251
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "teamId": {
      "name": "teamId",
      "columnName": "team_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 15,
          "col": 15,
          "endLine": 15,
          "endCol": 19,
          "start": 301,
          "end": 305
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "userId": {
      "name": "userId",
      "columnName": "user_id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 16,
          "col": 15,
          "endLine": 16,
          "endCol": 19,
          "start": 320,
          "end": 324
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "isActive": {
      "name": "isActive",
      "columnName": "is_active",
      "type": {
        "kind": "TypeExpr",
        "name": "BOOLEAN",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/team.schema",
          "line": 17,
          "col": 15,
          "endLine": 17,
          "endCol": 22,
          "start": 339,
          "end": 346
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": true
    }
  },
  "columnToField": {
    "id": "id",
    "team_id": "teamId",
    "user_id": "userId",
    "is_active": "isActive"
  },
  "relations": [
    {
      "name": "team",
      "kind": "belongsTo",
      "targetModel": "Team",
      "localKey": "teamId",
      "foreignKey": "id",
      "unique": true
    },
    {
      "name": "user",
      "kind": "belongsTo",
      "targetModel": "User",
      "localKey": "userId",
      "foreignKey": "id",
      "unique": true
    }
  ]
} as const;
export const userModelMeta = {
  "name": "User",
  "tableName": "user",
  "quotedTableName": "\"user\"",
  "primaryKeyFields": [
    "id"
  ],
  "fields": [
    {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 7,
          "col": 19,
          "endLine": 7,
          "endCol": 23,
          "start": 88,
          "end": 92
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "email",
      "columnName": "email",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 8,
          "col": 19,
          "endLine": 8,
          "endCol": 31,
          "start": 164,
          "end": 176
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "name",
      "columnName": "name",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 150
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 9,
          "col": 19,
          "endLine": 9,
          "endCol": 31,
          "start": 283,
          "end": 295
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "role",
      "columnName": "role",
      "type": {
        "kind": "TypeExpr",
        "name": "UserRole",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 10,
          "col": 19,
          "endLine": 10,
          "endCol": 27,
          "start": 314,
          "end": 322
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": true,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    {
      "name": "age",
      "columnName": "age",
      "type": {
        "kind": "TypeExpr",
        "name": "SMALLINT",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 11,
          "col": 19,
          "endLine": 11,
          "endCol": 28,
          "start": 359,
          "end": 368
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "balance",
      "columnName": "balance",
      "type": {
        "kind": "TypeExpr",
        "name": "INTEGER",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 12,
          "col": 19,
          "endLine": 12,
          "endCol": 26,
          "start": 454,
          "end": 461
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "isActive",
      "columnName": "is_active",
      "type": {
        "kind": "TypeExpr",
        "name": "BOOLEAN",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 13,
          "col": 19,
          "endLine": 13,
          "endCol": 26,
          "start": 480,
          "end": 487
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": true
    },
    {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 14,
          "col": 19,
          "endLine": 14,
          "endCol": 28,
          "start": 525,
          "end": 534
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "updatedAt",
      "columnName": "updated_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 15,
          "col": 19,
          "endLine": 15,
          "endCol": 29,
          "start": 571,
          "end": 581
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    {
      "name": "passwordHash",
      "columnName": "password_hash",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 16,
          "col": 19,
          "endLine": 16,
          "endCol": 32,
          "start": 615,
          "end": 628
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  ],
  "fieldByName": {
    "id": {
      "name": "id",
      "columnName": "id",
      "type": {
        "kind": "TypeExpr",
        "name": "UUID",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 7,
          "col": 19,
          "endLine": 7,
          "endCol": 23,
          "start": 88,
          "end": 92
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": true,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "email": {
      "name": "email",
      "columnName": "email",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 8,
          "col": 19,
          "endLine": 8,
          "endCol": 31,
          "start": 164,
          "end": 176
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": true,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "name": {
      "name": "name",
      "columnName": "name",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 150
          }
        ],
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 9,
          "col": 19,
          "endLine": 9,
          "endCol": 31,
          "start": 283,
          "end": 295
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "role": {
      "name": "role",
      "columnName": "role",
      "type": {
        "kind": "TypeExpr",
        "name": "UserRole",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 10,
          "col": 19,
          "endLine": 10,
          "endCol": 27,
          "start": 314,
          "end": 322
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": true,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    },
    "age": {
      "name": "age",
      "columnName": "age",
      "type": {
        "kind": "TypeExpr",
        "name": "SMALLINT",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 11,
          "col": 19,
          "endLine": 11,
          "endCol": 28,
          "start": 359,
          "end": 368
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    "balance": {
      "name": "balance",
      "columnName": "balance",
      "type": {
        "kind": "TypeExpr",
        "name": "INTEGER",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 12,
          "col": 19,
          "endLine": 12,
          "endCol": 26,
          "start": 454,
          "end": 461
        }
      },
      "optional": false,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": true,
      "isString": false,
      "isBoolean": false
    },
    "isActive": {
      "name": "isActive",
      "columnName": "is_active",
      "type": {
        "kind": "TypeExpr",
        "name": "BOOLEAN",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 13,
          "col": 19,
          "endLine": 13,
          "endCol": 26,
          "start": 480,
          "end": 487
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": true
    },
    "createdAt": {
      "name": "createdAt",
      "columnName": "created_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 14,
          "col": 19,
          "endLine": 14,
          "endCol": 28,
          "start": 525,
          "end": 534
        }
      },
      "optional": false,
      "hasDefault": true,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    "updatedAt": {
      "name": "updatedAt",
      "columnName": "updated_at",
      "type": {
        "kind": "TypeExpr",
        "name": "TIMESTAMP",
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 15,
          "col": 19,
          "endLine": 15,
          "endCol": 29,
          "start": 571,
          "end": 581
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": false,
      "isBoolean": false
    },
    "passwordHash": {
      "name": "passwordHash",
      "columnName": "password_hash",
      "type": {
        "kind": "TypeExpr",
        "name": "VARCHAR",
        "args": [
          {
            "kind": "NumberLiteral",
            "value": 255
          }
        ],
        "optional": true,
        "loc": {
          "file": "/Users/delleansantosteixeira/Projects/postgrest.js/schema/user.schema",
          "line": 16,
          "col": 19,
          "endLine": 16,
          "endCol": 32,
          "start": 615,
          "end": 628
        }
      },
      "optional": true,
      "hasDefault": false,
      "isId": false,
      "isUnique": false,
      "isEnum": false,
      "isNumeric": false,
      "isString": true,
      "isBoolean": false
    }
  },
  "columnToField": {
    "id": "id",
    "email": "email",
    "name": "name",
    "role": "role",
    "age": "age",
    "balance": "balance",
    "is_active": "isActive",
    "created_at": "createdAt",
    "updated_at": "updatedAt",
    "password_hash": "passwordHash"
  },
  "relations": [
    {
      "name": "profile",
      "kind": "hasOne",
      "targetModel": "Profile",
      "localKey": "id",
      "foreignKey": "userId",
      "unique": true
    },
    {
      "name": "orders",
      "kind": "hasMany",
      "targetModel": "Order",
      "localKey": "id",
      "foreignKey": "userId",
      "unique": false
    },
    {
      "name": "teamMembers",
      "kind": "hasMany",
      "targetModel": "TeamMember",
      "localKey": "id",
      "foreignKey": "userId",
      "unique": false
    }
  ]
} as const;
