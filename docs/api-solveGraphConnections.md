# solveGraphConnections

Find all valid traversal paths between two entities in the loaded data model, score them, and return the one with the highest weight as the optimal solution. This is the core of the graph client.

## Signature

```javascript
solveGraphConnections(pStartEntityName, pDestinationEntity, pEntityPathHints, pBaseGraphConnection, pParentEntity, pWeight)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pStartEntityName` | string | The entity to start traversal from (typically the pivotal entity of your query) |
| `pDestinationEntity` | string | The entity to reach |
| `pEntityPathHints` | array | Optional. Entity names to prefer when multiple valid paths exist |
| `pBaseGraphConnection` | object | **Internal.** Used for recursion; leave undefined on initial calls |
| `pParentEntity` | object | **Internal.** Used for recursion |
| `pWeight` | number | **Internal.** Current weight as the recursion descends |

**Only the first three parameters are meant for external callers.** The last three are used by the method to recurse into itself and should be left undefined.

**Returns:** The base `GraphConnection` object after the recursive search completes. The important fields are:

| Field | Description |
|-------|-------------|
| `PotentialSolutions` | Array of all candidate paths found, each with a `Weight`, `EdgeAddress`, and `RequestPath` |
| `OptimalSolutionPath` | The highest-weight entry in `PotentialSolutions`, or `false` if none were found |
| `EdgeTraversalEndpoints` | The `Start-->Destination` string for this search |
| `FromManualPath` | `true` if a manual path short-circuited the search |
| `EntityPathHints` | The union of per-call hints and `DefaultHints` |

## When to Use It

Call `solveGraphConnections` directly when:

- You want to preview what path the solver will pick without actually running a query
- You want to inspect all candidate paths, not just the optimal
- You're debugging why a query isn't returning what you expect
- You're building a visual explain-plan for your data graph

For actual query execution, use [`compileFilter`](api-compileFilter.md) or [`get`](api-get.md), which call `solveGraphConnections` for each required entity.

## Code Example: Simple Direct Traversal

```javascript
let tmpSolution = _GraphClient.solveGraphConnections('BookAuthorJoin', 'Book');

console.log(tmpSolution.OptimalSolutionPath.EdgeAddress);
// → 'BookAuthorJoin-->Book'

console.log(tmpSolution.OptimalSolutionPath.Weight);
// → 99925 (StartingWeight - TraversalHopWeight + OutgoingJoinWeight + JoinInTableNameWeight bonus)

console.log(tmpSolution.PotentialSolutions.length);
// → 1
```

`BookAuthorJoin` has a direct outgoing join to `Book` (via `IDBook`), so the solver finds it in one hop.

## Code Example: Traversal Through a Join Table

```javascript
let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Author');

console.log(tmpSolution.OptimalSolutionPath.EdgeAddress);
// → 'Book-->BookAuthorJoin-->Author'

console.log(tmpSolution.OptimalSolutionPath.RequestPath);
// → [
//     { Entity: 'Author', Depth: 3, DataSet: 'Book-->BookAuthorJoin-->Author', ... },
//     { Entity: 'BookAuthorJoin', Depth: 2, DataSet: 'Book-->BookAuthorJoin', FilterValueColumn: 'IDAuthor', ... },
//     { Entity: 'Book', Depth: 1, DataSet: 'Book', FilterValueColumn: 'IDBook', ... }
//   ]
```

The `RequestPath` array describes the concrete hops in reverse (destination first, base last). The `get()` method walks this array to build its request plan.

## Code Example: Using Hints

```javascript
// Without hints
let tmpNoHints = _GraphClient.solveGraphConnections('Book', 'Author');
console.log('No hints:', tmpNoHints.OptimalSolutionPath.Weight);
// → 99850 (approx.)

// With a hint for BookAuthorJoin
let tmpWithHints = _GraphClient.solveGraphConnections('Book', 'Author', ['BookAuthorJoin']);
console.log('With hint:', tmpWithHints.OptimalSolutionPath.Weight);
// → 299850 (approx. — hint bonus of +200000)
console.log('Hint weight:', tmpWithHints.OptimalSolutionPath.HintWeight);
// → 200000
```

Hints add a big weight bonus (`HintWeight`, default `200000`) for every hinted entity in the final path. This nearly always floats hinted paths to the top of the potential-solutions list.

## Code Example: Inspect All Candidates

```javascript
let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Author');

console.log('Candidate solutions:');
tmpSolution.PotentialSolutions.forEach((pSolution, pIndex) =>
{
    console.log(`  ${pIndex}: ${pSolution.EdgeAddress} (weight: ${pSolution.Weight})`);
});
// Example output:
//   0: Book-->BookAuthorJoin-->Author (weight: 99850)
//   1: Book-->Rating-->Author (weight: 99800)
```

The candidates are sorted by weight descending, so index 0 is always the optimal.

## Code Example: Debug a Failing Traversal

```javascript
let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Publisher');

if (!tmpSolution.OptimalSolutionPath)
{
    console.log('No path found from Book to Publisher');
    console.log('Attempted paths:', Object.keys(tmpSolution.AttemptedPaths));
    console.log('Attempted route hashes:', Object.keys(tmpSolution.AttemptedRouteHashes));
    console.log('Attempted entities:', Object.keys(tmpSolution.AttemptedEntities));
}
```

When the solver can't reach the destination, `OptimalSolutionPath` is `false` and `PotentialSolutions` is empty. The `AttemptedPaths`, `AttemptedRouteHashes`, and `AttemptedEntities` maps show every edge the solver tried — useful for understanding why it gave up.

## Code Example: Maximum Traversal Depth

```javascript
// Default MaximumTraversalDepth is 25
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        MaximumTraversalDepth: 3       // bail out after 3 hops
    });

let tmpSolution = _GraphClient.solveGraphConnections('Customer', 'ProductCategory');

if (!tmpSolution.OptimalSolutionPath)
{
    console.log('No solution within 3 hops');
}
```

Lowering `MaximumTraversalDepth` can help you catch queries that reach across too many tables, making them cheaper to find during development.

## Hint Resolution

Hints can come from three sources:

1. **Per-call** — the third argument to `solveGraphConnections`
2. **DefaultHints** — constructor option keyed by `EdgeTraversalEndpoints` (e.g., `'Book-->Author'`)
3. **Per-filter** — the `Hints` array on the filter object (passed through `compileFilter`)

At the base call, per-call hints are unioned with `DefaultHints[EdgeTraversalEndpoints]` (if any) to produce the final hint list, which is stored on `EntityPathHints` of the base graph connection and propagated to every recursive call.

## Manual Path Short-Circuit

If a manual path exists in `DefaultManualPaths` for the search's `EdgeTraversalEndpoints`, the solver returns the manual path as the sole potential solution without doing any real search. The returned base connection has `FromManualPath: true` to signal this:

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

let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Publisher');

console.log(tmpSolution.FromManualPath);
// → true
console.log(tmpSolution.OptimalSolutionPath.EdgeAddress);
// → 'Book-->PublisherCatalog-->Publisher'
```

See [Hints and Manual Paths](hints-and-manual-paths.md) for the full manual path format.

## Weight Formula (Repeat for Quick Reference)

```
solutionWeight = StartingWeight
               + (TraversalHopWeight × depth)
               + OutgoingJoinWeight   (if hop was outgoing)
               + JoinInTableNameWeight (if target ends in 'Join')
               + HintWeight × (hint matches in path)
```

All five knobs are configurable — see [Configuration Reference § Weight Tuning](configuration.md#weight-tuning).

## Caveats

- **Recursion is not fast but is cached per call chain.** The comment in the source says "Coded for readability as the first metric." Don't call `solveGraphConnections` in a hot loop — cache its result.
- **The `_GraphSolutionMap` cache is currently disabled** in the source due to concerns about caching hints correctly. Every call to `solveGraphConnections` with the same parameters does a fresh search.
- **The recursion is depth-first on each branch** but visits outgoing joins before incoming joins, so it'll find direct routes faster than routes that require an inbound hop.

## Related

- [compileFilter](api-compileFilter.md) — the main caller that invokes this once per required entity
- [Hints and Manual Paths](hints-and-manual-paths.md) — how to steer the solver
- [Configuration Reference § Weight Tuning](configuration.md#weight-tuning) — tune the scoring formula
- [Core Concepts § Graph Connection](concepts.md#graph-connection) — what the returned object looks like
