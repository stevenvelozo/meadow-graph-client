# addEntityToDataModel

Add a single meadow table to the graph. This is the per-table worker that `loadDataModel` calls in a loop; you can call it directly when you're composing a schema from many sources at runtime.

## Signature

```javascript
addEntityToDataModel(pEntity)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pEntity` | object | A meadow table definition with at minimum `TableName` (string) and `Columns` (array). Each column entry should have at least a `Column` field; entries with a `Join` field become graph edges. |

**Returns:** `true` on success, `false` if the entity lacks a `Columns` array, if `Columns` is not an array, or if the entity is already registered. Errors are logged via `this.log.error`.

## When to Use It

Use this when:

- You're building a graph client from multiple discrete table definitions rather than one large schema file
- You want to dynamically add tables at runtime based on configuration
- You're writing tests that only need two or three specific tables

For loading a complete meadow schema in one call, use [`loadDataModel`](api-loadDataModel.md) instead.

## Code Example

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

const _Fable = new libFable();
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

// Add a Book entity
_GraphClient.addEntityToDataModel(
    {
        TableName: 'Book',
        Columns:
            [
                { Column: 'IDBook', DataType: 'ID' },
                { Column: 'Title', DataType: 'String', Size: '200' },
                { Column: 'PublicationYear', DataType: 'Numeric' }
            ]
    });

// Add an Author entity
_GraphClient.addEntityToDataModel(
    {
        TableName: 'Author',
        Columns:
            [
                { Column: 'IDAuthor', DataType: 'ID' },
                { Column: 'Name', DataType: 'String', Size: '200' }
            ]
    });

// Add the BookAuthorJoin bridge with two join columns
_GraphClient.addEntityToDataModel(
    {
        TableName: 'BookAuthorJoin',
        Columns:
            [
                { Column: 'IDBookAuthorJoin', DataType: 'ID' },
                { Column: 'IDBook', DataType: 'Numeric', Join: 'IDBook' },
                { Column: 'IDAuthor', DataType: 'Numeric', Join: 'IDAuthor' }
            ]
    });

console.log(_GraphClient._KnownEntities);
// -> { Book: {...}, Author: {...}, BookAuthorJoin: {...} }

console.log(_GraphClient._OutgoingEntityConnectionLists.BookAuthorJoin);
// -> ['Book', 'Author']
```

## Join Column Handling

Each column with a `Join` field becomes a directed edge:

- The join target is derived from the `Join` field's value. If it starts with `ID`, the `ID` prefix is stripped (e.g., `"Join": "IDBook"` -> target entity `Book`). Otherwise the field value is used as-is.
- Two parallel edges are added: an outgoing edge on the source entity and an incoming edge on the target entity.
- The column name itself is kept as the label of the edge so the solver can reference it later when generating filter expressions.

### Example: Derived Target Name

```javascript
_GraphClient.addEntityToDataModel(
    {
        TableName: 'Review',
        Columns:
            [
                { Column: 'IDReview', DataType: 'ID' },
                { Column: 'Rating', DataType: 'Numeric' },
                { Column: 'IDBook', DataType: 'Numeric', Join: 'IDBook' }       // -> Book
            ]
    });

// After this call:
// _OutgoingEntityConnections.Review.Book === 'IDBook'
// _IncomingEntityConnections.Book.Review === 'IDBook'
```

## Ignored Audit Columns

These column names are always skipped even if they have `Join` fields:

- `CreatingIDUser`
- `UpdatingIDUser`
- `DeletingIDUser`
- `IDCustomer`

They're registered in `_KnownEntities` for filter purposes (you can still filter by `CreatingIDUser`), but no edges are created. See [Core Concepts § Ignore (Audit Columns)](concepts.md#ignore-audit-columns) for the rationale.

## Validation Errors

| Cause | Return | Log Message |
|-------|--------|-------------|
| Entity lacks `Columns` field | `false` | `Meadow Graph Client: Could not add Entity to the data model because it does not have a Columns property.` |
| `Columns` is not an array | `false` | `Meadow Graph Client: Could not add Entity to the data model because the Columns property is not an array.` |
| Entity already registered | `false` | `Meadow Graph Client: The Entity <name> is already known; it won't be added to the graph.` |

## What Happens Internally

1. Validates `Columns` is an array and the entity isn't already registered
2. Creates empty entries in `_KnownEntities`, `_OutgoingEntityConnections`, `_OutgoingEntityConnectionLists`, `_IncomingEntityConnections`, and `_IncomingEntityConnectionLists`
3. Iterates over every column, recording it in `_KnownEntities[tableName][columnName]`
4. For each non-audit column with a `Join` field, calls `addOutgoingConnection` and `addIncomingConnection` to register both sides of the edge

## Related

- [loadDataModel](api-loadDataModel.md) -- load an entire schema at once
- [cleanMissingEntityConnections](api-cleanMissingEntityConnections.md) -- clean up dangling edges if you add entities in a non-deterministic order
- [Core Concepts § Entity](concepts.md#entity) -- what makes something an entity in this module
