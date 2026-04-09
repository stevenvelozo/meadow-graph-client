# convertFilterObjectToFilterString

Convert an array of canonical filter expressions into a meadow-endpoints filter string — the tilde-delimited format that meadow's REST API consumes in URLs.

## Signature

```javascript
convertFilterObjectToFilterString(pFilterArray)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pFilterArray` | array | An array of canonical filter expression objects (the kind `parseFilterObject` produces inside `FilterExpressionSet[entity]`). Each expression must have `MeadowFilterType`, `Column`, `Operator`, and `Value` fields. |

**Returns:** a meadow filter string, or an empty string if `pFilterArray` is not an array or has fewer than one element.

## When to Use It

Call this when:

- You've built an array of filter expressions by hand and need to emit the URL-ready form
- You're integrating with something that expects a meadow-format filter string (like a meadow-endpoints URL) and want to use the graph client's expression builder to produce it
- You're debugging `compileFilter` output and want to see what the final URL filter will look like

In most production code paths, `compileFilter` calls `convertFilterObjectToFilterString` for you once per request when building the `MeadowFilter` field.

## The Output Format

The meadow filter string format is:

```
MeadowFilterType~Column~OperatorOpcode~Value[~MeadowFilterType~...]
```

Expressions are separated by `~` (tilde). Each expression has four tilde-delimited fields:

| Field | Description |
|-------|-------------|
| `MeadowFilterType` | One of `FBV` (AND), `FBVOR` (OR), `FOP` (open paren), `FCP` (close paren) |
| `Column` | The column name |
| `OperatorOpcode` | Two-letter opcode: `EQ`, `NE`, `GT`, `GE`, `LT`, `LE`, `LK`, `NLK`, `IN`, `NN`, `INN` |
| `Value` | The comparison value (serialized to string) |

## Code Example: Simple Filter

```javascript
let tmpExpressions =
    [
        {
            MeadowFilterType: 'FBV',
            Column: 'IDAuthor',
            Operator: '=',
            Value: 107
        }
    ];

let tmpString = _GraphClient.convertFilterObjectToFilterString(tmpExpressions);
console.log(tmpString);
// → 'FBV~IDAuthor~EQ~107'
```

## Code Example: Multiple Expressions AND-Joined

```javascript
let tmpExpressions =
    [
        { MeadowFilterType: 'FBV', Column: 'Title', Operator: 'LIKE', Value: 'The%' },
        { MeadowFilterType: 'FBV', Column: 'PublicationYear', Operator: '>=', Value: 1990 },
        { MeadowFilterType: 'FBV', Column: 'PublicationYear', Operator: '<=', Value: 1999 }
    ];

let tmpString = _GraphClient.convertFilterObjectToFilterString(tmpExpressions);
console.log(tmpString);
// → 'FBV~Title~LK~The%~FBV~PublicationYear~GE~1990~FBV~PublicationYear~LE~1999'
```

## Code Example: Mixed AND/OR

```javascript
let tmpExpressions =
    [
        { MeadowFilterType: 'FBV', Column: 'Genre', Operator: 'LIKE', Value: 'Fiction' },
        { MeadowFilterType: 'FBVOR', Column: 'Genre', Operator: 'LIKE', Value: 'Mystery' }
    ];

console.log(_GraphClient.convertFilterObjectToFilterString(tmpExpressions));
// → 'FBV~Genre~LK~Fiction~FBVOR~Genre~LK~Mystery'
```

## Code Example: Chaining With parseFilterObject

```javascript
let tmpParsed = _GraphClient.parseFilterObject(
    {
        Entity: 'Book',
        Filter:
        {
            'Author.IDAuthor': 107,
            'Title': 'The%'
        }
    });

// Convert the Book filter expressions to a string
let tmpBookString = _GraphClient.convertFilterObjectToFilterString(
    tmpParsed.FilterExpressionSet.Book);
console.log('Book filter string:', tmpBookString);
// → 'FBV~Title~LK~The%'

// Convert the Author filter expressions to a string
let tmpAuthorString = _GraphClient.convertFilterObjectToFilterString(
    tmpParsed.FilterExpressionSet.Author);
console.log('Author filter string:', tmpAuthorString);
// → 'FBV~IDAuthor~EQ~107'
```

## Operator Opcode Mapping

Internally this method calls `getFilterComparisonOperator(pExpression.Operator)` to map the user-facing operator to the meadow opcode:

| Operator | Opcode |
|----------|--------|
| `=` | `EQ` |
| `!=` | `NE` |
| `>` | `GT` |
| `>=` | `GE` |
| `<` | `LT` |
| `<=` | `LE` |
| `LIKE` | `LK` |
| `NOT LIKE` | `NLK` |
| `IS NULL` | `IN` |
| `IS NOT NULL` | `NN` |
| `IN` | `INN` |
| `(` | `FOP` |
| `)` | `FCP` |

Unknown operators are passed through unchanged.

## Code Example: Build a URL

```javascript
let tmpEntity = 'Book';
let tmpFilterArray =
    [
        { MeadowFilterType: 'FBV', Column: 'IDAuthor', Operator: '=', Value: 107 }
    ];

let tmpFilterString = _GraphClient.convertFilterObjectToFilterString(tmpFilterArray);
let tmpURL = `https://api.example.com/${tmpEntity}s/FilteredTo/${encodeURIComponent(tmpFilterString)}/0/1000`;

console.log(tmpURL);
// → https://api.example.com/Books/FilteredTo/FBV~IDAuthor~EQ~107/0/1000
```

This is exactly the URL shape `meadow-endpoints` expects for a filtered list request with pagination `(offset, limit)` = `(0, 1000)`.

## Edge Cases

- **Empty input:** returns `''`
- **Not an array:** returns `''`
- **Expression missing `Value`:** the string will contain `undefined` in place of the value — sanitize upstream
- **Value contains `~`:** the tilde in the value is not escaped; meadow-endpoints will treat it as a field separator. Currently there's no escape mechanism — avoid tildes in filter values or preprocess them

## Related

- [buildFilterExpression](api-buildFilterExpression.md) — build an individual expression that becomes an element of the input array
- [parseFilterObject](api-parseFilterObject.md) — the normal producer of expression arrays
- [compileFilter](api-compileFilter.md) — uses this method to populate the `MeadowFilter` field of each `Request`
- [Filter DSL Reference § Meadow Filter String Output](filter-dsl.md#meadow-filter-string-output)
