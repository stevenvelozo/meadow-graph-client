# Meadow Graph Client

> Pull comprehensions of data from relational database graphs by filter, not by JOIN

Meadow Graph Client is a Fable service provider that turns a meadow schema into an in-memory directed graph of join relationships, and turns user queries of the form `{Entity, Filter}` into a concrete ordered series of data requests against whatever transport you've plugged in. You describe what records you want in terms of columns from any reachable entity; the client walks the graph, scores the candidate paths, and builds a request plan that pulls the minimum set of records needed to satisfy the filter.

The module exists because expressing "give me all the Books by authors named `Dan Brown%` that have at least one discountable BookPrice" as a series of SQL JOINs and WHERE clauses is brittle, and because every additional hop across a join table adds another place for a bug to hide. When you describe the query as a filter object over entity names, the solver handles the hops for you and the same code keeps working when someone reshapes the schema or adds a new intermediate join table.

## Features

- **Graph-Based Filter Resolution** - Describe your query as `{Entity, Filter}` using column names from any reachable entity; the client walks the join graph and figures out the path
- **Implicit Data Model Loading** - Pass a meadow schema at construction time and every `IDFoo` column becomes an edge. Audit columns (`CreatingIDUser`, `UpdatingIDUser`, `DeletingIDUser`, `IDCustomer`) are ignored by default
- **Dot-Notation Filter Addressing** - Keys like `"Author.Name"` in a filter applied to `Book` tell the client that `Author` is also required; it figures out the traversal
- **Hinting** - A list of entity names the solver should prefer when multiple valid paths exist
- **Manual Paths** - Pre-built traversals for queries the automatic solver can't express
- **Pluggable Transport** - Override the base `MeadowGraphDataRequest` service with your own HTTP client, IPC bridge, or test fake
- **Weighted Path Scoring** - Multiple valid paths are scored by depth, join shape, and hint bonuses; the highest-weight solution wins
- **Cached Solution Maps** - Solved paths are reused across queries on the same instance
- **First-Class Fable Service Provider** - Standard lifecycle, logging, and service-manager integration

## How It Works

1. **Load a data model.** The client walks every table in the schema and registers each `Join` column as a directed edge (both outgoing on the source and incoming on the target) in two parallel adjacency maps.
2. **Receive a filter.** A user supplies `{Entity: 'Book', Filter: {...}}`. Keys in `Filter` can be plain column names (`Title`), dot-notation cross-entity references (`Author.IDAuthor`), or fully-specified filter expression objects.
3. **Lint and parse.** Defaults are filled in (`RecordLimit: 10000`, `PageSize: 100`, empty `Filter: {}`), then each filter entry is built into a canonical expression bound to the entity that owns the referenced column.
4. **Solve the graph.** For every entity referenced by the filter that isn't the pivotal entity, the client runs a recursive breadth-then-depth graph walk to find all valid traversal paths, scores them, and picks the optimal.
5. **Compile the request plan.** Each required entity gets a `Request` object with a meadow filter string and a list of downstream entity hops needed to resolve the data set.
6. **Execute.** The plan is handed to the pluggable `MeadowGraphDataRequest` service, which makes the actual HTTP/IPC/test calls and streams records back into the compiled filter object.

## Quick Start

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

const _Fable = new libFable();
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: require('./my-meadow-schema.json')
    });

_GraphClient.get(
    {
        Entity: 'Book',
        Filter:
        {
            'Author.IDAuthor': 107,
            'BookPrice.Discountable': true
        }
    },
    (pError, pCompiledGraphRequest) =>
    {
        if (pError)
        {
            console.error(pError);
            return;
        }
        console.log('Traversal plan:', pCompiledGraphRequest.Requests);
    });
```

The `get()` call walks the schema, discovers that `Book -> BookAuthorJoin -> Author` and `Book -> BookPrice` are the relevant traversals, emits an ordered request plan, and hands it to the data-request service. See [Quick Start](quickstart.md) for a complete walkthrough from schema load through record output.

## Where to Go Next

- [Quick Start](quickstart.md) -- five-minute walkthrough using the bookstore sample schema
- [Architecture](architecture.md) -- sequence diagrams and design trade-offs
- [Core Concepts](concepts.md) -- entities, filters, pagination, hints, and ignores explained
- [Filter DSL Reference](filter-dsl.md) -- every filter shape with examples
- [API Reference](api-reference.md) -- one page per public method
- [Hints and Manual Paths](hints-and-manual-paths.md) -- steering the solver
- [Data Request Service](data-request-service.md) -- plugging in your transport

## Related Packages

- [meadow](https://github.com/stevenvelozo/meadow) - Meadow ORM that produces the schemas this client consumes
- [meadow-endpoints](https://github.com/stevenvelozo/meadow-endpoints) - REST endpoints that a graph-client transport targets
- [foxhound](https://github.com/stevenvelozo/foxhound) - Meadow query DSL
- [stricture](https://github.com/stevenvelozo/stricture) - Meadow schema definitions
- [fable](https://github.com/stevenvelozo/fable) - Application services framework
