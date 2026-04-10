# loadDataModel

Load an entire meadow schema into the graph client. Walks every table in the schema and calls `addEntityToDataModel` for each one, which in turn registers both the table's columns in `_KnownEntities` and every `Join` column as an edge in both the outgoing and incoming connection maps.

## Signature

```javascript
loadDataModel(pDataModel)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pDataModel` | object | A meadow schema with a `Tables` property. Each entry in `Tables` is a meadow table definition with `TableName` and `Columns` fields. |

**Returns:** `true` on success, `false` if the argument is not an object or is missing the `Tables` property. Errors are logged via `this.log.error`.

## When to Use It

Use `loadDataModel` when you want to load an entire schema in one call. This is the most common approach -- you typically have a full meadow schema JSON file and just want the graph client to consume it wholesale.

There are two other ways to accomplish the same thing:

1. Pass the schema as the `DataModel` constructor option -- the constructor will call `loadDataModel` for you at instantiation time
2. Call `addEntityToDataModel` for each table individually -- useful when you're composing a schema from multiple sources at runtime

## Code Example

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

const _Fable = new libFable();
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

// Instantiate without a DataModel
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

// Load schemas in whatever order you want
const schemaBooks = require('./schema/bookstore.json');
const schemaReviews = require('./schema/reviews.json');

let tmpResult1 = _GraphClient.loadDataModel(schemaBooks);
let tmpResult2 = _GraphClient.loadDataModel(schemaReviews);

if (!tmpResult1 || !tmpResult2)
{
    console.error('One or more schemas failed to load');
    process.exit(1);
}

console.log(`Loaded ${Object.keys(_GraphClient._KnownEntities).length} entities`);
```

## Constructor-Time Equivalent

These two snippets are equivalent:

```javascript
// Option A: pass DataModel in constructor options
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    { DataModel: mySchema });

// Option B: instantiate empty then load
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
_GraphClient.loadDataModel(mySchema);
```

Use Option A when you know the schema at instantiation time; Option B when you need to defer loading (e.g., waiting for an async schema fetch).

## Merging Multiple Schemas

You can call `loadDataModel` multiple times to load schemas from different sources. Each call walks its `Tables` and tries to add them. If a table is already known, the second add will be rejected with a warning:

```javascript
_GraphClient.loadDataModel(schemaA);    // adds Book, Author, BookAuthorJoin
_GraphClient.loadDataModel(schemaB);    // adds Review, Rating (Book already exists -- warning)
```

If you want to replace an existing entity, delete it from `_KnownEntities` and the connection maps first -- but this is rarely a good idea. Prefer building your composite schema object before loading.

## What It Does Internally

1. Validates that the argument is an object and has a `Tables` property
2. Iterates over `Object.keys(pDataModel.Tables)`
3. Calls `addEntityToDataModel(pDataModel.Tables[tableName])` for each
4. Returns `true` regardless of how many individual adds succeeded -- check `_KnownEntities` after the call if you need to verify

Because `addEntityToDataModel` may fail for individual tables (missing `Columns`, duplicate, etc.) without stopping the batch, it's a good idea to call `cleanMissingEntityConnections()` after loading if you're unsure about the consistency of the input schemas.

## Validation Errors

| Cause | Log Message |
|-------|-------------|
| Argument not an object | `Meadow Graph Client: Could not load a DataModel because it was not passed in or set in the options.` |
| Missing `Tables` property | `Meadow Graph Client: The DataModel object does not have a Tables property or it is not an object, so cannot be loaded.` |

Both return `false` and leave the graph state unchanged.

## Related

- [addEntityToDataModel](api-addEntityToDataModel.md) -- add individual tables
- [cleanMissingEntityConnections](api-cleanMissingEntityConnections.md) -- clean up after partial loads
- [Configuration Reference § Data Model](configuration.md#data-model) -- constructor-time equivalent
