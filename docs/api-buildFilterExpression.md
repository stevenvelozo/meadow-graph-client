# buildFilterExpression

Build a single canonical filter expression from a raw filter entry. `buildFilterExpression` is called by `parseFilterObject` once per entry in the filter object. It's public so you can use it directly when constructing expressions programmatically.

## Signature

```javascript
buildFilterExpression(pPivotalEntity, pFilterKey, pFilterValue)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pPivotalEntity` | string | The default entity to use if the filter key doesn't specify one |
| `pFilterKey` | string or object | Either a column name (optionally with `Entity.Column` dot notation) or a fully-specified expression object |
| `pFilterValue` | any | The value to compare against. Required unless `pFilterKey` is already an object with a `Value` field. |

**Returns:** a canonical filter expression object with `Entity`, `Column`, `Value`, `Operator`, `Connector`, and `MeadowFilterType` — or `false` if the entity/column is unknown or the expression is invalid.

## The Output Shape

```javascript
{
    Entity: 'Book',
    Column: 'Title',
    Value: 'Breakfast%',
    Operator: 'LIKE',
    Connector: 'And',
    MeadowFilterType: 'FBV'
}
```

This is the same shape the meadow backend's filter engine consumes internally.

## When to Use It

Call `buildFilterExpression` directly when:

- You're constructing filter expressions one at a time in code rather than writing them as an object literal
- You want to take a user-supplied `{key, value}` pair and resolve it to a canonical expression before deciding whether to include it in a larger query
- You're writing a query builder UI that incrementally adds expressions

For bulk filter parsing, use `parseFilterObject`, which calls `buildFilterExpression` for you.

## Code Example: Three Input Forms

### Plain Column Name (String Key)

```javascript
let tmpExpression = _GraphClient.buildFilterExpression('Book', 'Title', 'The%');

console.log(tmpExpression);
// {
//   Entity: 'Book',
//   Column: 'Title',
//   Value: 'The%',
//   Operator: 'LIKE',       // default for String columns
//   Connector: 'And',
//   MeadowFilterType: 'FBV'
// }
```

### Dotted Cross-Entity Reference (String Key)

```javascript
let tmpExpression = _GraphClient.buildFilterExpression('Book', 'Author.IDAuthor', 107);

console.log(tmpExpression);
// {
//   Entity: 'Author',       // resolved from the dot notation
//   Column: 'IDAuthor',
//   Value: 107,
//   Operator: '=',          // default for numeric/ID columns
//   Connector: 'And',
//   MeadowFilterType: 'FBV'
// }
```

### Fully-Specified Object (Object Key)

```javascript
let tmpExpression = _GraphClient.buildFilterExpression('Book',
    {
        Column: 'PublicationYear',
        Operator: '>=',
        Value: 1990,
        Connector: 'And'
    });
// Note: pFilterValue is not used when pFilterKey is an object —
// the object should already contain the Value.

console.log(tmpExpression);
// {
//   Entity: 'Book',            // inherited from pPivotalEntity
//   Column: 'PublicationYear',
//   Operator: '>=',
//   Value: 1990,
//   Connector: 'And',
//   MeadowFilterType: 'FBV'
// }
```

## Default Resolution

Missing fields are filled in using the following rules:

| Field | Default |
|-------|---------|
| `Entity` | The dot-prefix of the key, or `pPivotalEntity` if no dot |
| `Column` | The post-dot part of the key (or the whole key if no dot) |
| `Operator` | Resolved from the column's `DataType` via `getDefaultFilterExpressionOperator` — `LIKE` for String/Text, `=` for everything else |
| `Connector` | `'And'` |
| `MeadowFilterType` | Derived from the connector and operator via `getMeadowFilterType` |

## Validation Errors

| Cause | Return | Log Message |
|-------|--------|-------------|
| `pFilterKey` is an object without `Value` | `false` | `Manual filter expression object <json> doesn't contain a Value property; skipping it.` |
| Entity not found in `_KnownEntities` | `false` | `Filter expression for [<Entity>.<Column>] references unknown entity <Entity>.` |
| Column not found on the entity | `false` | `Filter expression for [<Entity>.<Column>] references unknown Column <Column>.` |

All three cases log an error and return `false`. `parseFilterObject` (which is the normal caller) silently skips `false` results.

## Code Example: Building a Filter Dynamically

```javascript
function buildFilterFromFormState(pGraphClient, pEntity, pFormState)
{
    let tmpFilter = { Entity: pEntity, Filter: {} };

    // pFormState might be: { title: 'The%', authorID: 107, minYear: 1990 }
    if (pFormState.title)
    {
        let tmpExpr = pGraphClient.buildFilterExpression(pEntity, 'Title', pFormState.title);
        if (tmpExpr) tmpFilter.Filter.titleHash = tmpExpr;
    }
    if (pFormState.authorID)
    {
        let tmpExpr = pGraphClient.buildFilterExpression(pEntity, 'Author.IDAuthor', pFormState.authorID);
        if (tmpExpr) tmpFilter.Filter.authorHash = tmpExpr;
    }
    if (pFormState.minYear)
    {
        let tmpExpr = pGraphClient.buildFilterExpression(pEntity,
            { Column: 'PublicationYear', Operator: '>=', Value: pFormState.minYear });
        if (tmpExpr) tmpFilter.Filter.yearHash = tmpExpr;
    }

    return tmpFilter;
}

let tmpFilterObject = buildFilterFromFormState(_GraphClient, 'Book',
    { title: 'The%', authorID: 107, minYear: 1990 });

_GraphClient.get(tmpFilterObject, (pError, pResult) => {
    // ...
});
```

## Default Operator Helper

The operator default is supplied by `getDefaultFilterExpressionOperator`:

```javascript
_GraphClient.getDefaultFilterExpressionOperator('String');   // → 'LIKE'
_GraphClient.getDefaultFilterExpressionOperator('Text');     // → 'LIKE'
_GraphClient.getDefaultFilterExpressionOperator('Numeric');  // → '='
_GraphClient.getDefaultFilterExpressionOperator('Boolean');  // → '='
_GraphClient.getDefaultFilterExpressionOperator('ID');       // → '='
_GraphClient.getDefaultFilterExpressionOperator('DateTime'); // → '='
```

## Related

- [parseFilterObject](api-parseFilterObject.md) — bulk entry point that calls this per filter entry
- [Filter DSL Reference § Filter Entries](filter-dsl.md#filter-entries) — all three input forms
- [convertFilterObjectToFilterString](api-convertFilterObjectToFilterString.md) — turn an array of these into a meadow filter string
