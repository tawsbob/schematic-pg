// Auto-generated model metadata. Do not edit manually.
import type { ModelMetaSnapshot } from 'schematic-pg/db/model-meta';

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
          "line": 15,
          "col": 19,
          "endLine": 15,
          "endCol": 23
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
          "line": 16,
          "col": 19,
          "endLine": 16,
          "endCol": 31
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
          "line": 17,
          "col": 19,
          "endLine": 17,
          "endCol": 31
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
          "line": 18,
          "col": 19,
          "endLine": 18,
          "endCol": 27
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
          "line": 19,
          "col": 19,
          "endLine": 19,
          "endCol": 28
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
          "line": 20,
          "col": 19,
          "endLine": 20,
          "endCol": 26
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
          "line": 21,
          "col": 19,
          "endLine": 21,
          "endCol": 26
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
          "line": 22,
          "col": 19,
          "endLine": 22,
          "endCol": 28
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
          "line": 23,
          "col": 19,
          "endLine": 23,
          "endCol": 29
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
          "line": 24,
          "col": 19,
          "endLine": 24,
          "endCol": 32
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
          "line": 15,
          "col": 19,
          "endLine": 15,
          "endCol": 23
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
          "line": 16,
          "col": 19,
          "endLine": 16,
          "endCol": 31
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
          "line": 17,
          "col": 19,
          "endLine": 17,
          "endCol": 31
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
          "line": 18,
          "col": 19,
          "endLine": 18,
          "endCol": 27
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
          "line": 19,
          "col": 19,
          "endLine": 19,
          "endCol": 28
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
          "line": 20,
          "col": 19,
          "endLine": 20,
          "endCol": 26
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
          "line": 21,
          "col": 19,
          "endLine": 21,
          "endCol": 26
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
          "line": 22,
          "col": 19,
          "endLine": 22,
          "endCol": 28
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
          "line": 23,
          "col": 19,
          "endLine": 23,
          "endCol": 29
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
          "line": 24,
          "col": 19,
          "endLine": 24,
          "endCol": 32
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
      "unique": true,
      "relationName": "UserProfile"
    },
    {
      "name": "orders",
      "kind": "hasMany",
      "targetModel": "Order",
      "localKey": "id",
      "foreignKey": "userId",
      "unique": false
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
          "line": 45,
          "col": 15,
          "endLine": 45,
          "endCol": 19
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
          "line": 46,
          "col": 15,
          "endLine": 46,
          "endCol": 19
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
          "line": 47,
          "col": 15,
          "endLine": 47,
          "endCol": 19
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
          "line": 48,
          "col": 15,
          "endLine": 48,
          "endCol": 27
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
          "line": 49,
          "col": 15,
          "endLine": 49,
          "endCol": 20
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
          "line": 45,
          "col": 15,
          "endLine": 45,
          "endCol": 19
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
          "line": 46,
          "col": 15,
          "endLine": 46,
          "endCol": 19
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
          "line": 47,
          "col": 15,
          "endLine": 47,
          "endCol": 19
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
          "line": 48,
          "col": 15,
          "endLine": 48,
          "endCol": 27
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
          "line": 49,
          "col": 15,
          "endLine": 49,
          "endCol": 20
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
      "unique": true,
      "relationName": "UserProfile"
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
          "line": 61,
          "col": 18,
          "endLine": 61,
          "endCol": 22
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
          "line": 62,
          "col": 18,
          "endLine": 62,
          "endCol": 22
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
          "line": 63,
          "col": 18,
          "endLine": 63,
          "endCol": 29
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
          "line": 64,
          "col": 18,
          "endLine": 64,
          "endCol": 32
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
          "line": 65,
          "col": 18,
          "endLine": 65,
          "endCol": 23
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
          "line": 66,
          "col": 18,
          "endLine": 66,
          "endCol": 27
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
          "line": 67,
          "col": 18,
          "endLine": 67,
          "endCol": 28
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
          "line": 61,
          "col": 18,
          "endLine": 61,
          "endCol": 22
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
          "line": 62,
          "col": 18,
          "endLine": 62,
          "endCol": 22
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
          "line": 63,
          "col": 18,
          "endLine": 63,
          "endCol": 29
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
          "line": 64,
          "col": 18,
          "endLine": 64,
          "endCol": 32
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
          "line": 65,
          "col": 18,
          "endLine": 65,
          "endCol": 23
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
          "line": 66,
          "col": 18,
          "endLine": 66,
          "endCol": 27
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
          "line": 67,
          "col": 18,
          "endLine": 67,
          "endCol": 28
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
          "line": 77,
          "col": 16,
          "endLine": 77,
          "endCol": 20
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
          "line": 78,
          "col": 16,
          "endLine": 78,
          "endCol": 20
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
          "line": 79,
          "col": 16,
          "endLine": 79,
          "endCol": 25
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
          "line": 77,
          "col": 16,
          "endLine": 77,
          "endCol": 20
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
          "line": 78,
          "col": 16,
          "endLine": 78,
          "endCol": 20
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
          "line": 79,
          "col": 16,
          "endLine": 79,
          "endCol": 25
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
          "line": 83,
          "col": 18,
          "endLine": 83,
          "endCol": 22
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
          "line": 84,
          "col": 18,
          "endLine": 84,
          "endCol": 30
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
          "line": 85,
          "col": 18,
          "endLine": 85,
          "endCol": 22
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
          "line": 86,
          "col": 18,
          "endLine": 86,
          "endCol": 32
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
          "line": 87,
          "col": 18,
          "endLine": 87,
          "endCol": 25
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
          "line": 88,
          "col": 18,
          "endLine": 88,
          "endCol": 30
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
          "line": 89,
          "col": 18,
          "endLine": 89,
          "endCol": 24
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
          "line": 90,
          "col": 18,
          "endLine": 90,
          "endCol": 23
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
          "line": 91,
          "col": 18,
          "endLine": 91,
          "endCol": 27
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
          "line": 92,
          "col": 18,
          "endLine": 92,
          "endCol": 28
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
          "line": 83,
          "col": 18,
          "endLine": 83,
          "endCol": 22
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
          "line": 84,
          "col": 18,
          "endLine": 84,
          "endCol": 30
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
          "line": 85,
          "col": 18,
          "endLine": 85,
          "endCol": 22
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
          "line": 86,
          "col": 18,
          "endLine": 86,
          "endCol": 32
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
          "line": 87,
          "col": 18,
          "endLine": 87,
          "endCol": 25
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
          "line": 88,
          "col": 18,
          "endLine": 88,
          "endCol": 30
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
          "line": 89,
          "col": 18,
          "endLine": 89,
          "endCol": 24
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
          "line": 90,
          "col": 18,
          "endLine": 90,
          "endCol": 23
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
          "line": 91,
          "col": 18,
          "endLine": 91,
          "endCol": 27
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
          "line": 92,
          "col": 18,
          "endLine": 92,
          "endCol": 28
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
          "line": 112,
          "col": 16,
          "endLine": 112,
          "endCol": 22
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
          "line": 113,
          "col": 16,
          "endLine": 113,
          "endCol": 20
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
          "line": 114,
          "col": 16,
          "endLine": 114,
          "endCol": 20
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
          "line": 115,
          "col": 16,
          "endLine": 115,
          "endCol": 23
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
          "line": 116,
          "col": 16,
          "endLine": 116,
          "endCol": 30
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
          "line": 112,
          "col": 16,
          "endLine": 112,
          "endCol": 22
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
          "line": 113,
          "col": 16,
          "endLine": 113,
          "endCol": 20
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
          "line": 114,
          "col": 16,
          "endLine": 114,
          "endCol": 20
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
          "line": 115,
          "col": 16,
          "endLine": 115,
          "endCol": 23
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
          "line": 116,
          "col": 16,
          "endLine": 116,
          "endCol": 30
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
