# Hints and Manual Paths

When the graph solver has to pick between several valid traversal paths, or when it can't express a traversal at all, you have two tools: **hints** and **manual paths**. Hints bias the solver without replacing it. Manual paths bypass the solver entirely.

## When the Solver Needs Help

Consider a schema where `Book` and `Author` can be joined through multiple routes:

```
Book --- BookAuthorJoin --- Author       (the canonical many-to-many bridge)
Book --- Rating --- Author                (Rating has both IDBook and IDAuthor for review attribution)
Book --- Cart --- CartDetail --- Transaction --- Customer --- Author   (a nonsense route through purchase history)
```

Without guidance, the solver will enumerate all three paths, score them, and pick the highest-weight one. The short routes win on hop count, but the scorer can't know that `BookAuthorJoin` is "the right answer" semantically — both `BookAuthorJoin` and `Rating` are two hops and have the same weight.

This is where hints come in.

## Hints

A **hint** is an array of entity names the solver should prefer when picking a path. Matching entities in the candidate path get a large weight bonus (`HintWeight`, default `+200000`), which nearly always floats hinted paths to the top.

### Per-Call Hints

Pass hints as the third argument to `solveGraphConnections`:

```javascript
let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Author', ['BookAuthorJoin']);

console.log(tmpSolution.OptimalSolutionPath.EdgeAddress);
// → 'Book-->BookAuthorJoin-->Author'

console.log(tmpSolution.OptimalSolutionPath.HintWeight);
// → 200000
```

Or include them in the filter object passed to `compileFilter` / `get`:

```javascript
_GraphClient.get(
    {
        Entity: 'Book',
        Filter: { 'Author.IDAuthor': 107 },
        Hints: ['BookAuthorJoin']
    },
    (pError, pResult) =>
    {
        // ...
    });
```

### Default Hints

Set `DefaultHints` at construction time when a hint should apply to every query between two specific entities. The key is the `EdgeTraversalEndpoints` string (`Start-->Destination`), and the value is an array of preferred entity names:

```javascript
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DefaultHints:
        {
            'Book-->Author': ['BookAuthorJoin'],
            'Customer-->Product': ['CartDetail', 'Transaction'],
            'Author-->Review': ['ReaderAuthorReview']
        }
    });

// Now every query that needs to go from Book to Author
// will naturally prefer the BookAuthorJoin route.
_GraphClient.get({ Entity: 'Book', Filter: { 'Author.IDAuthor': 107 } },
    (pError, pResult) =>
    {
        // OptimalSolutionPath.EdgeAddress is 'Book-->BookAuthorJoin-->Author'
    });
```

### How Default Hints Merge With Per-Call Hints

At the base recursion call, per-call hints are union'd with the matching `DefaultHints` entry to form the final hint list:

```javascript
// Constructor setup
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DefaultHints: { 'Book-->Author': ['BookAuthorJoin'] }
    });

// Per-call with an additional hint
let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Author', ['ReviewAuthor']);

// The effective hint list is ['BookAuthorJoin', 'ReviewAuthor']
console.log(tmpSolution.EntityPathHints);
```

The union is deduplicated — a hint that appears in both places is counted once.

### Hint Scoring

A hint only contributes its weight bonus when the candidate path actually contains the hinted entity. Hints for entities that the candidate path doesn't visit add nothing, so it's safe to list many hints for a single traversal — only the ones that match will score.

Each matching hint adds `HintWeight` (default `200000`). Multiple matches stack:

```
path: Book → BookAuthorJoin → Author
hints: ['BookAuthorJoin', 'Author']
hintWeight: 200000 × 2 = 400000
```

### When Hints Aren't Enough

Hints bias the solver but don't replace it. If the graph simply has no valid path between two entities — because the join isn't on an ID column, or because the schema is missing an intermediate table the solver needs — hints can't manifest a solution out of thin air. That's when you need a manual path.

## Manual Paths

A **manual path** is a fully-built traversal that bypasses the solver entirely. When the solver is asked to find a path whose `EdgeTraversalEndpoints` key exists in `DefaultManualPaths`, it short-circuits at the base call and returns the manual path as the sole potential solution.

### When to Use a Manual Path

- **Joins on non-ID columns** (e.g., `Book.ISBN = PublisherCatalog.ISBN`)
- **Traversals that require custom filter logic** the solver can't express
- **Guaranteed, hand-audited paths for hot queries** where you don't want the solver's decisions to drift as the schema evolves
- **Legacy data models** where the graph shape doesn't match meadow conventions

### Manual Path Format

A manual path is an object with the same shape as a `PotentialSolution` returned by the solver:

```javascript
{
    Weight: 999999,                      // any large positive number
    EdgeAddress: 'Book-->PublisherCatalog-->Publisher',
    RequestPath:
        [
            {
                Entity: 'Publisher',
                Depth: 3,
                DataSet: 'Book-->PublisherCatalog-->Publisher',
                FilterValueColumn: false,
                FilterSourceDataSet: false
            },
            {
                Entity: 'PublisherCatalog',
                Depth: 2,
                DataSet: 'Book-->PublisherCatalog',
                FilterValueColumn: 'ISBN',
                FilterSourceDataSet: 'Book-->PublisherCatalog-->Publisher'
            },
            {
                Entity: 'Book',
                Depth: 1,
                DataSet: 'Book',
                FilterValueColumn: 'ISBN',
                FilterSourceDataSet: 'Book-->PublisherCatalog'
            }
        ]
}
```

The `RequestPath` array runs destination-first (deepest entity at index 0) to base-last, matching the format the solver's `generateRequestPath` produces. Each entry:

| Field | Description |
|-------|-------------|
| `Entity` | The entity at this step |
| `Depth` | Distance from the base entity (1 = base) |
| `DataSet` | The edge address of this step |
| `FilterValueColumn` | The column to read from the *previous* step's results to filter this step. `false` for the endpoint (outermost) entry. |
| `FilterSourceDataSet` | The `DataSet` of the previous step that holds the filter source values. `false` for the endpoint entry. |

### Registering a Manual Path

Pass manual paths via the `DefaultManualPaths` constructor option, keyed by `EdgeTraversalEndpoints`:

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
                RequestPath: [ /* ... */ ]
            }
        }
    });
```

### Testing a Manual Path

```javascript
let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Publisher');

console.log(tmpSolution.FromManualPath);
// → true

console.log(tmpSolution.PotentialSolutions);
// → [ { Weight: 999999, EdgeAddress: 'Book-->PublisherCatalog-->Publisher', ... } ]

console.log(tmpSolution.OptimalSolutionPath.EdgeAddress);
// → 'Book-->PublisherCatalog-->Publisher'
```

The `FromManualPath: true` field is how you tell at runtime whether the solver short-circuited.

### Code Example: Building a Manual Path By Hand

```javascript
// A minimal 2-hop manual path for Book-->Author via a fictitious AuthorBookRef entity
let tmpManualPath =
    {
        Weight: 500000,
        EdgeAddress: 'Book-->AuthorBookRef-->Author',
        RequestPath:
            [
                {
                    Entity: 'Author',
                    Depth: 3,
                    DataSet: 'Book-->AuthorBookRef-->Author',
                    FilterValueColumn: false,
                    FilterSourceDataSet: false
                },
                {
                    Entity: 'AuthorBookRef',
                    Depth: 2,
                    DataSet: 'Book-->AuthorBookRef',
                    FilterValueColumn: 'IDAuthor',
                    FilterSourceDataSet: 'Book-->AuthorBookRef-->Author'
                },
                {
                    Entity: 'Book',
                    Depth: 1,
                    DataSet: 'Book',
                    FilterValueColumn: 'IDBook',
                    FilterSourceDataSet: 'Book-->AuthorBookRef'
                }
            ]
    };

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DefaultManualPaths:
        {
            'Book-->Author': tmpManualPath
        }
    });
```

### Getting the RequestPath Format Right

The easiest way to produce a manual path is to let the solver build one for you with a similar schema, then hand-edit it. Inspect `tmpSolution.OptimalSolutionPath.RequestPath` from a working search and use it as a template — change the entity names and filter columns to match your real path.

## Choosing Hints vs Manual Paths

| Situation | Use |
|-----------|-----|
| Multiple valid paths, one is semantically preferred | **Hint** |
| Multiple valid paths, one needs to be forced | **Hint** (with large bonus) |
| Path joins on a non-ID column | **Manual Path** |
| Path requires custom filter logic | **Manual Path** |
| Legacy schema the solver can't reach | **Manual Path** |
| Hot query where you want absolute stability | **Manual Path** |
| Ambiguous wildcards in a production query | **Default Hints** |

Start with hints — they're cheaper to maintain because the solver continues to track schema evolution. Move to manual paths only when hints can't express what you need.

## Related

- [solveGraphConnections](api-solveGraphConnections.md) — where hints and manual paths take effect
- [Configuration Reference § Default Hints](configuration.md#default-hints) — constructor option reference
- [Configuration Reference § Default Manual Paths](configuration.md#default-manual-paths) — constructor option reference
- [Core Concepts § Hint and Manual Path](concepts.md#hint)
