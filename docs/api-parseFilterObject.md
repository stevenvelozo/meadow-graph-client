# parseFilterObject

Parse a filter object into canonical form, grouping filter expressions by the entity they apply to. This is the second stage of the query pipeline after `lintFilterObject` and before `solveGraphConnections`.

## Signature

```javascript
parseFilterObject(pFilterObject)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pFilterObject` | object | A filter object. Should have been linted first; parseFilterObject does not call `lintFilterObject` for you. |

**Returns:** a new object with:

| Field | Type | Description |
|-------|------|-------------|
| `Entity` | string | The pivotal entity, copied from the input |
| `SourceFilterObject` | object | The original input filter object (minus any self-reference) |
| `FilterExpressionSet` | object | Map of `EntityName -> array of canonical filter expressions` |
| `RequiredEntities` | array | List of entity names that appear in `FilterExpressionSet` |
| `SolutionMap` | object | Empty object to be populated by the graph solver later |

## When to Use It

Call `parseFilterObject` directly when:

- You want to inspect what entities a filter would require before running the full compile
- You want to validate that filter keys resolve to known columns without making a request
- You're building tooling (an admin UI, a query builder) that needs to show the user which tables their query will touch

For actual query execution, use [`compileFilter`](api-compileFilter.md) or [`get`](api-get.md), which call `parseFilterObject` internally.

## Code Example: Inspect Required Entities

```javascript
let tmpParsed = _GraphClient.parseFilterObject(
    {
        Entity: 'Book',
        Filter:
        {
            'Author.IDAuthor': 107,
            'BookPrice.Discountable': true,
            'Title': 'The%'
        }
    });

console.log(tmpParsed.RequiredEntities);
// -> [ 'Book', 'Author', 'BookPrice' ]

console.log(tmpParsed.FilterExpressionSet.Author);
// -> [ { Entity: 'Author', Column: 'IDAuthor', Value: 107, Operator: '=', ... } ]

console.log(tmpParsed.FilterExpressionSet.Book);
// -> [ { Entity: 'Book', Column: 'Title', Value: 'The%', Operator: 'LIKE', ... } ]

console.log(tmpParsed.FilterExpressionSet.BookPrice);
// -> [ { Entity: 'BookPrice', Column: 'Discountable', Value: true, Operator: '=', ... } ]
```

## How It Groups Expressions

For each entry in `pFilterObject.Filter`:

1. Calls `buildFilterExpression(pivotalEntity, hashKey, value)` to produce a canonical expression
2. Reads the resulting `Entity` field on the expression (which may differ from the pivotal entity if the hash key used dot notation)
3. Pushes the expression onto `FilterExpressionSet[entity]`, creating the array if needed

Dot-notation keys like `'Author.IDAuthor'` are resolved by `buildFilterExpression` to have `Entity: 'Author', Column: 'IDAuthor'`, so they land in `FilterExpressionSet.Author` rather than `FilterExpressionSet.Book`.

## Code Example: Dry-Run a Filter for UI Feedback

```javascript
function describeFilterImpact(pGraphClient, pFilter)
{
    let tmpParsed = pGraphClient.parseFilterObject(pFilter);

    return {
        pivotalEntity: tmpParsed.Entity,
        touchedEntities: tmpParsed.RequiredEntities,
        expressionCount: Object.values(tmpParsed.FilterExpressionSet)
            .reduce((sum, arr) => sum + arr.length, 0),
        perEntity: Object.fromEntries(
            Object.entries(tmpParsed.FilterExpressionSet).map(
                ([entity, exprs]) => [entity, exprs.map(e => `${e.Column} ${e.Operator} ${e.Value}`)]
            )
        )
    };
}

let tmpImpact = describeFilterImpact(_GraphClient,
    {
        Entity: 'Book',
        Filter:
        {
            'Author.IDAuthor': 107,
            'BookPrice.Discountable': true
        }
    });

console.log(JSON.stringify(tmpImpact, null, 2));
// {
//   "pivotalEntity": "Book",
//   "touchedEntities": ["Book", "Author", "BookPrice"],
//   "expressionCount": 2,
//   "perEntity": {
//     "Book": [],
//     "Author": ["IDAuthor = 107"],
//     "BookPrice": ["Discountable = true"]
//   }
// }
```

## Invalid Filter Entries

If `buildFilterExpression` returns `false` for any entry (unknown entity, unknown column, missing `Value`), that entry is silently skipped. The error is logged via `buildFilterExpression` itself. Check the logs after parsing if you expect all entries to succeed.

The core entity always gets an empty array in `FilterExpressionSet` even if no filters target it -- this ensures `RequiredEntities` always includes the pivotal entity.

## Source Filter Object Cleanup

If the input filter object already has a `SourceFilterObject` field (from a previous parse), it's deleted to prevent recursive nesting when reusing filter objects across multiple parses. The cleaned source is then attached to the returned object as `SourceFilterObject`.

## Related

- [lintFilterObject](api-lintFilterObject.md) -- always call this first to ensure the input has `Filter` and `Options`
- [buildFilterExpression](api-buildFilterExpression.md) -- the per-entry worker called by `parseFilterObject`
- [compileFilter](api-compileFilter.md) -- the full pipeline that includes `parseFilterObject`
- [Filter DSL Reference](filter-dsl.md)
