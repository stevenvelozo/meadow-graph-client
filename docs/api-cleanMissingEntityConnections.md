# cleanMissingEntityConnections

Remove outgoing connection edges that point to entities that don't exist in `_KnownEntities`. Useful when you've loaded a partial schema and want to prune dangling edges before querying.

## Signature

```javascript
cleanMissingEntityConnections()
```

No parameters. No return value. Modifies `_OutgoingEntityConnections` and `_OutgoingEntityConnectionLists` in place and logs each removed edge via `this.log.warn`.

## When to Use It

Use this after:

- Loading a schema subset where some tables are missing (e.g., you only loaded `Book` and `BookAuthorJoin` but not `Author`)
- Constructing entities manually in an unknown order (say, adding a `Review` with an `IDBook` join column before you add `Book`)
- Merging schemas from multiple sources where the first source references entities from the second

If you don't clean up, the solver will try to traverse the dangling edges and fail at query time.

## Code Example

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

const _Fable = new libFable();
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

// Load only two of three tables — Author is missing
_GraphClient.addEntityToDataModel(
    {
        TableName: 'Book',
        Columns: [{ Column: 'IDBook', DataType: 'ID' }]
    });

_GraphClient.addEntityToDataModel(
    {
        TableName: 'BookAuthorJoin',
        Columns:
            [
                { Column: 'IDBookAuthorJoin', DataType: 'ID' },
                { Column: 'IDBook', DataType: 'Numeric', Join: 'IDBook' },
                { Column: 'IDAuthor', DataType: 'Numeric', Join: 'IDAuthor' }  // → Author (missing!)
            ]
    });

// Before cleanup, BookAuthorJoin has a dangling edge to Author
console.log(_GraphClient._OutgoingEntityConnectionLists.BookAuthorJoin);
// → ['Book', 'Author']

// Clean up
_GraphClient.cleanMissingEntityConnections();

// After cleanup, the dangling Author edge is gone
console.log(_GraphClient._OutgoingEntityConnectionLists.BookAuthorJoin);
// → ['Book']
```

You'll see a warning in the logs for every removed edge:

```
Meadow Graph Client: Removing Outgoing connection edge from [BookAuthorJoin] to [Author] because the target entity is missing.
```

## When You Don't Need It

If all your schema loads come from complete, self-consistent meadow schemas (which is the usual case when you're using `meadow` to export the schema in the first place), you never need to call this. Every table referenced by a `Join` will already be in the schema.

## What It Does Internally

1. Iterates over every entity in `_OutgoingEntityConnections`
2. For each outgoing target, checks if the target entity exists in `_KnownEntities`
3. If not, deletes the target from both `_OutgoingEntityConnections[entity]` and removes it from `_OutgoingEntityConnectionLists[entity]`
4. Logs a warning for each removal

Note that it only cleans *outgoing* edges. Incoming edges are not pruned — this is a known limitation. If you need symmetric cleanup, call `cleanMissingEntityConnections` and then manually walk `_IncomingEntityConnections` for the same check.

## Related

- [loadDataModel](api-loadDataModel.md) — the method whose output this cleans up after
- [addEntityToDataModel](api-addEntityToDataModel.md) — adds entities one at a time, which is where dangling edges tend to appear
