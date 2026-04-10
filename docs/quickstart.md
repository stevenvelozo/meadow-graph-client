# Quick Start

Get a working graph-based query running in under five minutes against the sample bookstore schema that ships with the module.

## 1. Install

```bash
npm install meadow-graph-client fable
```

Add `fable` too -- the graph client is a Fable service provider and needs a Fable instance to run.

## 2. Wire It Up

Create `quickstart.js`:

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

// The bookstore sample schema ships with the module (for testing)
const modelBookStore = require('meadow-graph-client/test/model/Retold-SampleData-Bookstore.json');

// Create a Fable instance
const _Fable = new libFable();

// Register the graph client as a service type
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

// Instantiate with the schema loaded at construction time
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: modelBookStore
    });

console.log('Known entities:', Object.keys(_GraphClient._KnownEntities));
```

Run it:

```bash
node quickstart.js
```

You should see something like:

```
Known entities: [ 'Book', 'BookAuthorJoin', 'Author', 'BookPrice', 'Review', ... ]
```

The schema is loaded and every join relationship has been wired into the in-memory graph.

## 3. Inspect the Graph Connections

Add a few lines to see how the graph solver will view your schema:

```javascript
console.log('Book outgoing joins to:', _GraphClient._OutgoingEntityConnectionLists.Book);
console.log('Book incoming joins from:', _GraphClient._IncomingEntityConnectionLists.Book);
console.log('BookAuthorJoin outgoing joins to:', _GraphClient._OutgoingEntityConnectionLists.BookAuthorJoin);
```

Output:

```
Book outgoing joins to: []
Book incoming joins from: [ 'BookAuthorJoin', 'BookPrice', 'Review' ]
BookAuthorJoin outgoing joins to: [ 'Book', 'Author' ]
```

`Book` has no outgoing joins -- the traversal to `Author` has to go through the `BookAuthorJoin` join table. That's exactly what the solver will figure out in the next step.

## 4. Solve a Simple Path

```javascript
let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Author');

console.log('Optimal path:', tmpSolution.OptimalSolutionPath.EdgeAddress);
console.log('Weight:', tmpSolution.OptimalSolutionPath.Weight);
console.log('Hops:', tmpSolution.OptimalSolutionPath.RequestPath.length);
```

Output:

```
Optimal path: Book-->BookAuthorJoin-->Author
Weight: 99850
Hops: 3
```

The solver walked `Book`'s incoming joins, found `BookAuthorJoin`, walked its outgoing joins, found `Author`, and declared that path the winner. No SQL, no hand-written JOINs.

## 5. Run a Real Query

Now ask a question against the data model using a filter:

```javascript
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

        console.log('Required entities:', pCompiledGraphRequest.ParsedFilter.RequiredEntities);
        console.log('Request plan:');
        for (let tmpRequest of pCompiledGraphRequest.Requests)
        {
            console.log(`  ${tmpRequest.Entity}: ${tmpRequest.MeadowFilter}`);
            console.log(`    Graph chain: ${tmpRequest.GraphRequestChain.join(' -> ')}`);
        }
    });
```

Output:

```
Required entities: [ 'Book', 'Author', 'BookPrice' ]
Request plan:
  Author: FBV~IDAuthor~EQ~107
    Graph chain: BookAuthorJoin
  BookPrice: FBV~Discountable~EQ~true
    Graph chain:
```

Two downstream entity requests (`Author` and `BookPrice`), with a generated meadow filter string for each, and the intermediate hops needed to get back to the pivotal `Book` entity. The data request service will execute each of these in order and attach the results to the compiled filter object.

## 6. Plug In a Real Transport

Up to this point the default `MeadowGraphDataRequest` stub is being used, which doesn't actually send HTTP requests -- it just returns `null` from its `doGetJSON`/`doPostJSON`/`doPutJSON` methods. To make real queries against a running meadow-endpoints server, either:

### Option A: Override the base request service

```javascript
const libMeadowGraphDataRequest = require('meadow-graph-client/source/Meadow-Graph-Service-DataRequest.js');
const libHTTPS = require('https');

class HTTPSGraphDataRequest extends libMeadowGraphDataRequest
{
    doGetJSON(pURL, fCallback)
    {
        libHTTPS.get(pURL, (pResponse) =>
        {
            let tmpBody = '';
            pResponse.on('data', (pChunk) => { tmpBody += pChunk; });
            pResponse.on('end', () =>
            {
                try
                {
                    return fCallback(null, JSON.parse(tmpBody));
                }
                catch (pError)
                {
                    return fCallback(pError, null);
                }
            });
        }).on('error', (pError) => fCallback(pError, null));
    }
}
```

### Option B: Point the graph client at a different service name

```javascript
_Fable.addAndInstantiateSingletonService('MyHTTPRequestService', {}, require('./my-http-service.js'));

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: modelBookStore,
        DataRequestClientService: 'MyHTTPRequestService'
    });
```

Either way, the graph solver and filter DSL stay identical -- only the transport changes.

## 7. Add a Hint When Multiple Paths Exist

If the schema has several plausible paths between two entities, use a hint to steer the solver:

```javascript
let tmpResult = _GraphClient.solveGraphConnections('Book', 'Author', ['BookAuthorJoin']);
console.log('Hint-steered path:', tmpResult.OptimalSolutionPath.EdgeAddress);
console.log('Hint weight bonus:', tmpResult.OptimalSolutionPath.HintWeight);
```

The hinted solution gets a large weight bonus (`HintWeight: 200000` by default), which nearly always floats it to the top.

You can also set default hints at construction time so every query benefits from them:

```javascript
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: modelBookStore,
        DefaultHints:
        {
            'Book-->Author': ['BookAuthorJoin']
        }
    });
```

## 8. Read the Next Sections

- [Core Concepts](concepts.md) -- the vocabulary (`Entity`, `Filter`, `Hint`, `ManualPath`, `EdgeAddress`) explained in detail
- [Filter DSL Reference](filter-dsl.md) -- every shape a filter can take with example inputs and outputs
- [Architecture](architecture.md) -- sequence diagrams for graph solving and request execution
- [API Reference](api-reference.md) -- one page per public method with code snippets

## Full Quickstart Script

For copy-paste convenience, here's the complete script from this walkthrough:

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

const modelBookStore = require('meadow-graph-client/test/model/Retold-SampleData-Bookstore.json');

const _Fable = new libFable();
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: modelBookStore,
        DefaultHints:
        {
            'Book-->Author': ['BookAuthorJoin']
        }
    });

console.log('Known entities:', Object.keys(_GraphClient._KnownEntities).length);

let tmpSolution = _GraphClient.solveGraphConnections('Book', 'Author');
console.log('Book -> Author path:', tmpSolution.OptimalSolutionPath.EdgeAddress);

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
        if (pError) return console.error(pError);

        console.log('Required entities:', pCompiledGraphRequest.ParsedFilter.RequiredEntities);
        for (let tmpRequest of pCompiledGraphRequest.Requests)
        {
            console.log(`  ${tmpRequest.Entity}: ${tmpRequest.MeadowFilter}`);
        }
    });
```
