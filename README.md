# Meadow Graph Client

> Pull comprehensions of data from relational database graphs by filter, not by JOIN

Meadow Graph Client is a Fable service provider that lets you describe what records you want in terms of **entities and filters**, and it figures out the rest. Given a meadow schema, it builds an in-memory directed graph of every join relationship, then resolves a user filter -- even when the filter references columns on entities multiple hops away from the entity you're actually pulling -- into a concrete ordered series of requests to fetch the records. The request execution is delegated to a pluggable data-request service so the same client works against any meadow backend (HTTP API, IPC, in-memory, mocked).

If you've ever written something like "give me all the Books by authors named `Dan Brown%` that have at least one discountable BookPrice" and felt the pain of writing the JOIN-and-subquery SQL by hand, this module exists for you.

## Features

- **Graph-Based Filter Resolution** - Describe your query as `{Entity, Filter}` using column names from any reachable entity; the client walks the join graph and figures out the path
- **Implicit Data Model Loading** - Pass a meadow schema and every `IDFoo` column gets wired up as an edge automatically. Audit columns (`CreatingIDUser`, `IDCustomer`, etc.) are ignored by default
- **Dot-Notation Filter Addressing** - `"Author.Name": "Dan Brown"` on a `Book` query; the client figures out which entities need to be pulled
- **Hinting** - Steer path resolution when multiple valid routes exist (`Book->Author` via `BookAuthorJoin` versus via `Rating`) without hand-coding joins
- **Manual Paths** - Drop in a fully-crafted traversal when the automatic solver can't figure out something exotic (e.g. non-ID joins across custom columns)
- **Pluggable Transport** - Override the `MeadowGraphDataRequest` stub with your HTTP client, IPC bridge, or test fake; the graph logic stays the same
- **Cached Graph Solutions** - Solved path maps are cached per client instance so repeated queries reuse the same traversal work
- **Weighted Path Scoring** - Multiple valid traversal paths are scored by depth, join shape, and hint bonuses; the highest-weight path wins
- **First-Class Fable Service Provider** - Standard lifecycle, logging, and service manager integration

## Quick Start

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

const _Fable = new libFable();
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

// Load your meadow schema at construction time
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: require('./my-meadow-schema.json')
    });

// Query: all Books by Author with IDAuthor = 107 that have a discountable price
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

The library walks the schema, discovers that `Book -> BookAuthorJoin -> Author` and `Book -> BookPrice` are the relevant paths, and emits an ordered request plan your data-request service can execute.

## Installation

```bash
npm install meadow-graph-client
```

`meadow-graph-client` is self-contained on the graph logic side. The only required runtime dependency is `fable-serviceproviderbase`. To actually fetch records you will supply (or override) a `MeadowGraphDataRequest` service -- see [the data request service guide](docs/data-request-service.md).

## Core Concepts

- **Entity** -- a meadow table (`Book`, `Author`, `BookAuthorJoin`, etc.) with columns, an `ID` column, and zero or more `Join` columns linking to other entities
- **Filter** -- a user-supplied `{Entity, Filter}` object describing what records you want. Keys can be `ColumnName`, `EntityName.ColumnName`, or a fully-specified filter expression object
- **Graph Path** -- a solved traversal through the data model from the query's pivotal entity to some other entity referenced by the filter, expressed as an `EdgeAddress` like `Book-->BookAuthorJoin-->Author`
- **Hint** -- a list of entity names the solver should prefer when multiple paths exist
- **Manual Path** -- a pre-built traversal that bypasses the solver entirely, for complex joins on non-ID columns

Read more in [Core Concepts](docs/concepts.md).

## Documentation

Full documentation is available in the [`docs`](./docs) folder, or served locally via [pict-docuserve](https://github.com/stevenvelozo/pict-docuserve):

- [Overview](docs/README.md) - What the module is, what it solves, how it fits together
- [Quick Start](docs/quickstart.md) - End-to-end walkthrough with the bookstore sample schema
- [Architecture](docs/architecture.md) - Design, data flow, sequence diagrams, and trade-offs
- [Core Concepts](docs/concepts.md) - Entities, filters, pagination, hints, and ignores
- [Filter DSL Reference](docs/filter-dsl.md) - Every shape a filter can take
- [Configuration Reference](docs/configuration.md) - Constructor options and fable settings
- [API Reference](docs/api-reference.md) - Every public method with a dedicated page
- [Hints and Manual Paths](docs/hints-and-manual-paths.md) - Steer graph resolution
- [Data Request Service](docs/data-request-service.md) - Plug in your HTTP/IPC transport

## Related Packages

- [meadow](https://github.com/stevenvelozo/meadow) - Meadow ORM that produces the schemas this client consumes
- [meadow-endpoints](https://github.com/stevenvelozo/meadow-endpoints) - REST endpoints that a meadow-graph-client transport targets
- [foxhound](https://github.com/stevenvelozo/foxhound) - Meadow query DSL
- [stricture](https://github.com/stevenvelozo/stricture) - Meadow schema definitions
- [fable](https://github.com/stevenvelozo/fable) - Application services framework

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/stevenvelozo/retold/blob/main/docs/contributing.md).
