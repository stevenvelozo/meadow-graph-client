# Core Concepts

The Meadow Graph Client has a small vocabulary. Once you understand these five terms — Entity, Filter, Pagination, Hint, Ignore — the rest of the API reference reads directly.

## Entity

An **Entity** is a meadow table with a name, a column map, and zero or more `Join` columns that connect it to other entities. Entities are identified by their `TableName` in the meadow schema. Once loaded into the graph client, an entity becomes a node in two adjacency maps:

- `_OutgoingEntityConnections[Entity] = { OtherEntity: 'IDOtherEntity', ... }` — entities this one references via its own `IDFoo` columns
- `_IncomingEntityConnections[Entity] = { OtherEntity: 'IDEntity', ... }` — entities that reference *this* entity via their `IDEntity` columns

Every query has a **pivotal entity** — the `Entity` field in your filter object. This is the entity whose records you ultimately want to receive. All other entities referenced by the filter are *required entities* that need to be visited during traversal in order to resolve the filter.

### The Meadow Naming Conventions

The graph client relies on two meadow conventions:

1. **ID columns are prefaced by `ID`** and the suffix correlates with the table name. `IDBook` is the primary key of `Book`; `IDAuthor` of `Author`; `IDBookAuthorJoin` of `BookAuthorJoin`.
2. **Join tables are postfixed with `Join`.** `BookAuthorJoin` is the classic many-to-many bridge between `Book` and `Author`; `ProductCategoryJoin` between `Product` and `Category`.

The solver uses (1) to discover edges and (2) to apply a bonus weight when a traversal passes through an entity whose name ends in `Join` — which is usually the "right" answer for many-to-many relationships.

## Filter

A **Filter** is a JavaScript object describing what records you want. It has two top-level fields:

```javascript
{
    Entity: 'Book',           // the pivotal entity
    Filter:                   // the actual filter expressions
    {
        'Author.IDAuthor': 107,
        'BookPrice.Discountable': true,
        'Title': 'Breakfast%'
    }
}
```

The keys in the inner `Filter` object can take three forms:

### 1. Plain Column Name

```javascript
{ 'Title': 'Breakfast%' }
```

A key with no dot is interpreted as a column on the pivotal entity. The default operator comes from the column's data type — `LIKE` for String and Text columns, `=` for everything else.

### 2. Dotted Cross-Entity Reference

```javascript
{ 'Author.IDAuthor': 107 }
```

A key with a dot is interpreted as `Entity.Column`. The client will add that entity to the required-entities list, run the graph solver to find a traversal from the pivotal entity, and include the entity in the request plan.

### 3. Fully-Specified Filter Expression

```javascript
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
```

When you need to override the default operator or connector, or when you want the hash key to be different from the column name (useful when building complex filters dynamically), pass an object. Any missing fields (`Entity`, `Operator`, `Connector`, `MeadowFilterType`) are filled in by the client.

See the [Filter DSL Reference](filter-dsl.md) for every shape a filter can take, including operator overrides, multi-value filters, and longhand vs. shorthand forms.

## Pagination

Every filter object carries an **Options** block (automatically populated by `lintFilterObject` if you don't supply one) controlling pagination:

| Option | Default | Description |
|--------|---------|-------------|
| `RecordLimit` | `10000` | Maximum records to return **per entity** in the query. The graph client applies this separately to each downstream entity request, not to the total number of records aggregated across the graph. |
| `PageSize` | `100` | Page size for paged requests. The transport layer is responsible for honoring this. |

```javascript
{
    Entity: 'Book',
    Filter: { 'Title': 'The%' },
    Options:
    {
        RecordLimit: 500,
        PageSize: 50
    }
}
```

`RecordLimit` is a safety net — with large graphs you don't want a stray wildcard filter pulling 2 million records across 15 entities. The default of 10000 per entity is deliberately generous for dev use; production services typically tune it down.

## Hint

A **Hint** is a hint to the graph solver that certain entity names should be preferred when picking a traversal path. Hints matter when the same pair of entities can be reached through multiple valid paths.

Consider a schema where `Book` and `Author` can be joined either via `BookAuthorJoin` (the canonical many-to-many bridge) or via `Rating` (which has both `IDBook` and `IDAuthor` columns for review attribution). Without hinting, both paths would be valid and the solver would score them by weight. With a hint:

```javascript
_GraphClient.solveGraphConnections('Book', 'Author', ['BookAuthorJoin']);
```

the `BookAuthorJoin` path gets a `HintWeight` bonus (default `+200000`) that nearly always floats it to the top.

Hints can be supplied in three places:

1. **Per-call** via the third argument to `solveGraphConnections`
2. **Per-filter** by adding a `Hints` array to the filter object
3. **At construction time** via the `DefaultHints` option, keyed by `EdgeTraversalEndpoints` (a string like `Book-->Author`)

```javascript
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DefaultHints:
        {
            'Book-->Author': ['BookAuthorJoin'],
            'Customer-->Product': ['CartDetail']
        }
    });
```

See [Hints and Manual Paths](hints-and-manual-paths.md) for a full treatment including when hints aren't enough.

## Ignore (Audit Columns)

The graph client automatically ignores a fixed set of **audit columns** when building the graph. These columns carry `Join` metadata in meadow schemas but represent star/spoke audit trails rather than genuine graph edges:

| Column | What It Represents |
|--------|--------------------|
| `CreatingIDUser` | The user who created the record |
| `UpdatingIDUser` | The user who last updated the record |
| `DeletingIDUser` | The user who soft-deleted the record |
| `IDCustomer` | The owning customer / tenant (multi-tenancy) |

If the solver included these, every entity in the schema would become one hop away from every other entity via `User` or `Customer`, and the graph would degenerate into a star. By skipping them, the graph preserves the actual business structure of the data model.

If you *need* to traverse a user or customer relationship, you have two options:

1. **Add a non-audit column** with a `Join` annotation (e.g. `IDReviewer` as a separate column from `CreatingIDUser`)
2. **Use a manual path** via `DefaultManualPaths` to describe the traversal explicitly

## Manual Path

A **Manual Path** is a pre-built traversal that bypasses the solver entirely. Use this when:

- The join is on a non-ID column (e.g. `Book.ISBN = PublisherCatalog.ISBN`)
- The join requires custom filter logic the solver can't express
- You want a guaranteed, repeatable, hand-audited path for a hot query

Manual paths are keyed by the edge-traversal endpoint string:

```javascript
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DefaultManualPaths:
        {
            'Book-->Publisher':
            {
                Weight: 999999,
                EdgeAddress: 'Book-->PublisherCatalog-->Publisher',
                RequestPath: [
                    /* fully-specified request path entries */
                ]
            }
        }
    });
```

When the solver is asked for `Book-->Publisher`, it will short-circuit and return this manual path as the only potential solution. See [Hints and Manual Paths](hints-and-manual-paths.md) for the full format.

## EdgeAddress

An **EdgeAddress** is a string of the form `Entity1-->Entity2-->Entity3` that represents a specific traversal through the graph. It's the canonical key used for:

- Caching solved solutions in `_GraphSolutionMap`
- Looking up manual paths in `DefaultManualPaths`
- Applying default hints in `DefaultHints`
- Debugging: when a traversal fails, the error message will show the edge addresses the solver tried

The top-level (base) edge address is just the start entity (`Book`); subsequent recursions build up `Book-->BookAuthorJoin`, `Book-->BookAuthorJoin-->Author`, and so on.

## Graph Connection

A **GraphConnection** is the solver's internal object representing one node in its search tree. The important fields on the base (top-level) graph connection:

| Field | Description |
|-------|-------------|
| `EntityName` | Current entity at this step |
| `EdgeAddress` | Path from the base entity to here |
| `EdgeTraversalEndpoints` | `{Start}-->{Destination}` string for the whole search |
| `AttemptedPaths` | Map of every edge address tried (prevents loops) |
| `AttemptedRouteHashes` | Map of `Start==>Dest` hashes tried (prevents redundant work) |
| `PotentialSolutions` | Array of successful paths, each with a `Weight` and `RequestPath` |
| `OptimalSolutionPath` | The `PotentialSolutions` entry with the highest weight — what the caller uses |
| `EntityPathHints` | The hints active for this search |

Most callers don't touch these internals directly — `compileFilter()` and `get()` abstract them away — but if you ever need to debug a confusing traversal, `solveGraphConnections()` returns the full `GraphConnection` object so you can inspect `PotentialSolutions` and understand why the solver picked what it picked.

## Request Plan

A **Request Plan** is the output of `compileFilter()`. It's an object with:

```javascript
{
    ParsedFilter: { /* normalised filter object */ },
    RequestPaths: { /* per-required-entity solved graph connections */ },
    Requests:
        [
            {
                Entity: 'Author',
                MeadowFilter: 'FBV~IDAuthor~EQ~107',
                GraphRequestChain: ['BookAuthorJoin']
            },
            {
                Entity: 'BookPrice',
                MeadowFilter: 'FBV~Discountable~EQ~true',
                GraphRequestChain: []
            }
        ]
}
```

`Requests` is the actual execution plan — one entry per required non-pivotal entity, with a meadow filter string and a list of intermediate entities that need to be pulled to carry the filter forward.

The `get()` method takes a plan like this, walks the `Requests` array, and invokes the data-request service for each entry in turn.
