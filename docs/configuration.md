# Configuration Reference

Meadow Graph Client accepts configuration through the service provider's constructor options. The module follows the standard Fable service provider pattern:

```javascript
_Fable.serviceManager.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: /* ... */,
        MaximumTraversalDepth: 25,
        DefaultHints: { /* ... */ },
        DefaultManualPaths: { /* ... */ }
    });
```

Defaults live in `source/Meadow-Graph-Client.js` under `_DefaultGraphClientConfiguration`. The constructor deep-copies the defaults and merges user-supplied options on top via `Object.assign`.

## Data Model

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `DataModel` | object | `undefined` | A meadow schema object with a `Tables` property. When present, `loadDataModel` is called automatically at construction time. If omitted, you must call `loadDataModel()` or `addEntityToDataModel()` yourself before querying. |

A meadow schema has the shape:

```javascript
{
    Tables:
    {
        Book: { TableName: 'Book', Columns: [ ... ] },
        Author: { TableName: 'Author', Columns: [ ... ] },
        // ...
    }
}
```

Each column entry needs at minimum `Column` and `DataType`. Columns with a `Join` property are registered as graph edges (unless they're audit columns — see [Ignored Columns](#ignored-columns)).

## Data Request Service

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `DataRequestClientService` | string | `'MeadowGraphClientDataRequest'` | Name of the Fable singleton service that will handle outbound HTTP/IPC requests. The constructor calls `fable.addAndInstantiateSingletonService(...)` with this name, registering the default stub. Override this to point the graph client at a different transport service you've already registered. |

To use your own transport:

```javascript
// Register your transport first
_Fable.addAndInstantiateSingletonService('MyHTTPSGraphRequest', {}, require('./my-https-graph-request.js'));

// Then point the graph client at it
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DataRequestClientService: 'MyHTTPSGraphRequest'
    });
```

See [Data Request Service](data-request-service.md) for the interface your custom transport needs to implement.

## Traversal Depth

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `MaximumTraversalDepth` | number | `25` | Maximum number of hops the solver will walk before bailing out on a given recursion branch. Prevents runaway recursion on schemas with cycles. |

Tune this up for deeply nested schemas (think: data warehouse star schemas with many join tables), tune it down to fail fast on invalid queries during development.

## Weight Tuning

The solver scores candidate paths using a weight formula. Tune these to bias the solver toward or against specific traversal patterns:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `StartingWeight` | number | `100000` | Every solved path starts here. Higher = more headroom for penalties. |
| `TraversalHopWeight` | number | `-100` | Added per hop; default is negative so shorter paths score higher. |
| `OutgoingJoinWeight` | number | `25` | Bonus added when the solver takes a direct outgoing join edge (e.g., `BookPrice → Book` via `IDBook`). Direct outgoing joins are usually the most natural traversal. |
| `JoinInTableNameWeight` | number | `25` | Bonus added when the target entity name ends in `Join` (e.g., `BookAuthorJoin`). Favors traversal through explicit join tables. |
| `HintWeight` | number | `200000` | Bonus added per matched hint in the candidate path. Deliberately very large so a single hint match dominates all other weight factors. |

### Weight Formula Recap

```
finalWeight = StartingWeight
            + sum of TraversalHopWeight per hop
            + OutgoingJoinWeight if hop was outgoing
            + JoinInTableNameWeight if target name ends in 'Join'
            + HintWeight × (hint matches in path)
```

### Worked Example

Consider the schema `Book ← BookAuthorJoin → Author` and the query `solveGraphConnections('Book', 'Author')`:

- Path: `Book → BookAuthorJoin → Author` (2 hops)
- Starting weight: `100000`
- Hops: `2 × -100 = -200`
- Outgoing joins used: 1 (BookAuthorJoin → Author) → `+25`
- `Join` in table name: yes (BookAuthorJoin ends in 'Join') → `+25`
- No hints → `+0`
- **Final: 99850**

With a hint (`['BookAuthorJoin']`):
- Same as above, plus `+200000` for the hint match
- **Final: 299850**

The hint bonus dwarfs everything else, which is intentional — hints are meant to be decisive.

## Default Hints

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `DefaultHints` | object | `{}` | Map of `EdgeTraversalEndpoints` → array of hint entity names. Merged with per-call hints during `solveGraphConnections`. |

Keys are the traversal endpoint string (e.g., `'Book-->Author'`) and values are arrays of entity names to prefer. These are union'd with any hints passed via the per-call `Hints` array, so you can set instance-wide defaults and still augment them per query.

```javascript
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DefaultHints:
        {
            'Book-->Author': ['BookAuthorJoin'],
            'Customer-->Product': ['CartDetail'],
            'Author-->Review': ['ReaderAuthorReview']
        }
    });
```

## Default Manual Paths

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `DefaultManualPaths` | object | `{}` | Map of `EdgeTraversalEndpoints` → fully-built path object. Bypasses the solver for these specific traversals. |

Use manual paths when the automatic solver can't express something — typically joins on non-ID columns or traversals that require custom filter logic:

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
                RequestPath:
                    [
                        { Entity: 'Publisher', Depth: 3, DataSet: 'Book-->PublisherCatalog-->Publisher' },
                        { Entity: 'PublisherCatalog', Depth: 2, DataSet: 'Book-->PublisherCatalog', FilterValueColumn: 'ISBN', FilterSourceDataSet: 'Book-->PublisherCatalog-->Publisher' },
                        { Entity: 'Book', Depth: 1, DataSet: 'Book', FilterValueColumn: 'ISBN', FilterSourceDataSet: 'Book-->PublisherCatalog' }
                    ]
            }
        }
    });
```

When the solver is asked to find `Book-->Publisher`, it will short-circuit on the base call and emit this manual path as the sole potential solution.

See [Hints and Manual Paths](hints-and-manual-paths.md) for the full manual-path object format.

## Ignored Columns

These column names are always skipped when building graph edges from the schema, regardless of configuration:

| Column | Why It's Ignored |
|--------|-----------------|
| `CreatingIDUser` | Audit column (who created this record) |
| `UpdatingIDUser` | Audit column (who last updated this record) |
| `DeletingIDUser` | Audit column (who soft-deleted this record) |
| `IDCustomer` | Multi-tenancy column (customer/tenant owner) |

Including these in the graph would make every entity one hop away from `User` and `Customer`, collapsing the graph to a star. There is currently no configuration option to disable this behavior — the filter is hard-coded in `addEntityToDataModel`.

If you need a user relationship that the solver *should* use, add a separate column to your schema (e.g., `IDReviewer` distinct from `CreatingIDUser`) or declare a manual path.

## Example: Production Configuration

A typical production configuration looks like this:

```javascript
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        // Load schema at construction
        DataModel: require('./schema/full-production-schema.json'),

        // Custom HTTP transport
        DataRequestClientService: 'AuthenticatedHTTPSRequest',

        // Slightly deeper than default for a wide schema
        MaximumTraversalDepth: 40,

        // Bias toward direct outgoing joins more strongly
        OutgoingJoinWeight: 50,

        // Canonical hints for ambiguous paths
        DefaultHints:
        {
            'Order-->Customer': ['CustomerOrder'],
            'Product-->Warehouse': ['WarehouseInventory'],
            'Invoice-->LineItem': ['InvoiceDetail']
        },

        // One manual path for a legacy non-ID join
        DefaultManualPaths:
        {
            'LegacyReport-->CurrentSystem': { /* ... */ }
        }
    });
```

## Fable Settings Fallback

Unlike some other Retold modules, `meadow-graph-client` does not currently read configuration from `fable.settings`. Everything must be passed through the constructor options on the second argument to `instantiateServiceProvider`. If you want to drive config from a JSON file, load it yourself and pass it to the constructor:

```javascript
const config = require('./my-meadow-graph-client-config.json');

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', config);
```
