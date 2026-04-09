# Filter DSL Reference

Every query to `meadow-graph-client` is a filter object with two required fields — `Entity` and `Filter` — and one optional `Options` block. This page is the exhaustive reference for every shape the `Filter` inner object can take.

## Top-Level Shape

```javascript
{
    Entity: 'Book',                  // required: the pivotal entity
    Filter: { /* filter entries */ },// required: the conditions (can be empty)
    Options:                         // optional; filled in by lintFilterObject
    {
        RecordLimit: 10000,
        PageSize: 100
    },
    Hints: ['BookAuthorJoin']        // optional: per-call solver hints
}
```

If `Filter` is omitted, `lintFilterObject` inserts an empty object. If `Options` is omitted, it's populated with the defaults above.

## Filter Entries

Each key in `Filter` is a *hash* — it doesn't need to match the column name; it just needs to be unique within the filter object. The value describes what to compare and how.

There are three forms:

### Shorthand: Plain Column Name

```javascript
{
    Entity: 'Book',
    Filter:
    {
        Title: 'Breakfast of Champions'
    }
}
```

The hash key (`Title`) is interpreted as a column on the pivotal entity (`Book`). The default operator comes from the column's meadow data type — `LIKE` for `String`/`Text` columns, `=` for everything else. Resolves internally to:

```javascript
{
    Entity: 'Book',
    Column: 'Title',
    Value: 'Breakfast of Champions',
    Operator: 'LIKE',
    Connector: 'And',
    MeadowFilterType: 'FBV'
}
```

### Shorthand: Dotted Cross-Entity Reference

```javascript
{
    Entity: 'Book',
    Filter:
    {
        'Author.IDAuthor': 107
    }
}
```

The dot splits the key into `Entity.Column`. The client automatically:

1. Adds `Author` to the required-entities list
2. Runs `solveGraphConnections('Book', 'Author', hints)` to find a traversal
3. Emits a separate request for `Author` filtered by `IDAuthor = 107`
4. Includes the intermediate hops (`BookAuthorJoin`) in the graph request chain

Resolves internally to:

```javascript
{
    Entity: 'Author',
    Column: 'IDAuthor',
    Value: 107,
    Operator: '=',
    Connector: 'And',
    MeadowFilterType: 'FBV'
}
```

### Longhand: Fully-Specified Expression Object

```javascript
{
    Entity: 'Book',
    Filter:
    {
        'NameIsIrrelevant':
        {
            Column: 'Name',
            Entity: 'Author',
            Operator: 'LIKE',
            Value: 'Dan Brown%',
            Connector: 'And'
        }
    }
}
```

Use longhand when:

- You need to override the default operator (e.g., `NE` instead of `=`)
- You need to override the connector (`Or` instead of `And`)
- You want the hash key to be different from the column name — useful when building filters dynamically from UI form state where two widgets might reference the same column
- You want to be explicit about which entity the filter targets when the column name is ambiguous

Any missing fields are filled in:

| Field | Default |
|-------|---------|
| `Entity` | The pivotal entity from the outer filter |
| `Operator` | Based on the column's data type (`LIKE` for String/Text, `=` for everything else) |
| `Connector` | `'And'` |
| `MeadowFilterType` | Derived from the connector and operator — see [Meadow Filter Types](#meadow-filter-types) below |

## Supported Operators

| Operator | Meaning | Meadow Opcode | Default For |
|----------|---------|---------------|-------------|
| `=` | Equal | `EQ` | All numeric, boolean, ID types |
| `!=` | Not equal | `NE` | — |
| `>` | Greater than | `GT` | — |
| `>=` | Greater than or equal | `GE` | — |
| `<` | Less than | `LT` | — |
| `<=` | Less than or equal | `LE` | — |
| `LIKE` | SQL LIKE (with `%` wildcards) | `LK` | String, Text types |
| `NOT LIKE` | SQL NOT LIKE | `NLK` | — |
| `IS NULL` | Is NULL | `IN` | — |
| `IS NOT NULL` | Is not NULL | `NN` | — |
| `IN` | SQL IN (comma-separated values) | `INN` | — |
| `(` | Open parenthesis (filter group) | `FOP` | — |
| `)` | Close parenthesis (filter group) | `FCP` | — |

The `getDefaultFilterExpressionOperator(pDataType)` method resolves a column's data type to the default operator; `getFilterComparisonOperator(pOperator)` converts a user-facing operator like `>=` to the meadow opcode `GE`.

## Connectors

Connectors join adjacent filter expressions. `And` is the default.

| Connector | Meaning | Meadow Filter Type |
|-----------|---------|--------------------|
| `And` | AND | `FBV` |
| `Or` | OR | `FBVOR` |

Group filter expressions with parentheses by inserting `(` and `)` entries:

```javascript
{
    Entity: 'Book',
    Filter:
    {
        'g1open': { Column: 'Genre', Value: '(' },
        'Fiction': { Column: 'Genre', Value: 'Fiction' },
        'Mystery': { Column: 'Genre', Value: 'Mystery', Connector: 'Or' },
        'g1close': { Column: 'Genre', Value: ')' },
        'PublicationYear': { Column: 'PublicationYear', Operator: '>=', Value: 2000 }
    }
}
```

## Meadow Filter Types

The internal `MeadowFilterType` field maps to a meadow-endpoints filter opcode:

| Type | Meaning |
|------|---------|
| `FBV` | Filter By Value (AND-joined) |
| `FBVOR` | Filter By Value (OR-joined) |
| `FOP` | Filter Open Parenthesis |
| `FCP` | Filter Close Parenthesis |

`getMeadowFilterType(pConnector, pOperator)` does the mapping:

- `pOperator === '('` → `FOP`
- `pOperator === ')'` → `FCP`
- `pConnector === 'OR'` → `FBVOR`
- Otherwise → `FBV`

## Options Block

Fields on `pFilterObject.Options`:

| Field | Default | Description |
|-------|---------|-------------|
| `RecordLimit` | `10000` | Max records per entity in the query |
| `PageSize` | `100` | Page size for paged requests |

These are applied by the data-request transport when building the final URL. The graph client doesn't enforce them directly — it passes them through.

## Hints Array

An optional `Hints` array steers the solver toward preferred entity names:

```javascript
{
    Entity: 'Book',
    Filter: { 'Author.IDAuthor': 107 },
    Hints: ['BookAuthorJoin']
}
```

When `compileFilter()` runs the solver for each required non-pivotal entity, it passes these hints as the third argument to `solveGraphConnections`. Matching entities in the candidate path get a large weight bonus (`HintWeight`, default `+200000`).

Hints can also be registered globally via the `DefaultHints` constructor option — see [Hints and Manual Paths](hints-and-manual-paths.md).

## Meadow Filter String Output

The final output of `convertFilterObjectToFilterString()` is a tilde-delimited string in the meadow-endpoints filter format:

```
FBV~Title~LK~Breakfast%
```

Multiple expressions are joined with tildes:

```
FBV~Genre~LK~Fiction~FBVOR~Genre~LK~Mystery~FBV~PublicationYear~GE~2000
```

This is the string that gets embedded in the URL when the transport makes a request to `meadow-endpoints`. You don't usually need to emit this yourself — `compileFilter()` and `get()` handle the conversion — but it's exposed via `convertFilterObjectToFilterString()` for cases where you want to hand-build a URL.

## Examples

### Simple Equality on Pivotal Entity

```javascript
{ Entity: 'Book', Filter: { Title: 'Breakfast of Champions' } }
```

### LIKE on Pivotal, Equality on Related Entity

```javascript
{
    Entity: 'Book',
    Filter:
    {
        Title: 'The%',
        'Author.Name': 'Dan Brown'
    }
}
```

### Numeric Range on Pivotal

```javascript
{
    Entity: 'Book',
    Filter:
    {
        yearStart: { Column: 'PublicationYear', Operator: '>=', Value: 1990 },
        yearEnd:   { Column: 'PublicationYear', Operator: '<=', Value: 1999 }
    }
}
```

### OR Across Related Entities

```javascript
{
    Entity: 'Book',
    Filter:
    {
        'Author.Name': 'Dan Brown',
        'Author.NameAlt':
        {
            Column: 'Name',
            Entity: 'Author',
            Operator: 'LIKE',
            Value: 'Vonnegut%',
            Connector: 'Or'
        }
    }
}
```

### With Explicit Options and Hints

```javascript
{
    Entity: 'Book',
    Filter: { 'Author.IDAuthor': 107 },
    Options: { RecordLimit: 500, PageSize: 50 },
    Hints: ['BookAuthorJoin']
}
```

### Filter on an Entity Two Hops Away

```javascript
{
    Entity: 'Book',
    Filter:
    {
        'Customer.Email': 'someone@example.com'
    }
}
```

If the schema looks like `Book ← CartDetail ← Cart → Customer`, the solver will walk `Book → CartDetail → Cart → Customer`, emit one request per intermediate hop, and use each result as the input filter for the next.
