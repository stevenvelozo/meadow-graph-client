# compileFilter

Run the full compile pipeline on a filter object: lint → parse → solve graph paths for each required entity → assemble an executable request plan. This is one level below `get()` — it produces the plan without actually executing it against the transport.

## Signature

```javascript
compileFilter(pFilterObject)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pFilterObject` | object | A filter object with at least an `Entity` field |

**Returns:** a compiled graph request object, or `false` if `lintFilterObject` rejected the input.

The compiled object has this shape:

```javascript
{
    ParsedFilter:
    {
        Entity: 'Book',
        FilterExpressionSet: { /* per-entity arrays */ },
        RequiredEntities: ['Book', 'Author', 'BookPrice'],
        SolutionMap: {},
        SourceFilterObject: { /* original input */ }
    },
    RequestPaths:
    {
        Author: { /* solved graph connection object for Book → Author */ },
        BookPrice: { /* solved graph connection object for Book → BookPrice */ }
    },
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

## When to Use It

Use `compileFilter` when:

- You want to preview the request plan your filter will generate without making any network calls
- You're writing an explain-plan visualizer
- You want to hand the plan to a custom execution engine instead of the built-in `get()`
- You're writing tests that assert the compiler produces the right plan

In production code paths, `get()` calls `compileFilter` for you and then executes the plan.

## Code Example: Basic Compile

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');

const _Fable = new libFable();
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: require('./test/model/Retold-SampleData-Bookstore.json')
    });

let tmpCompiled = _GraphClient.compileFilter(
    {
        Entity: 'Book',
        Filter:
        {
            'Author.IDAuthor': 107,
            'BookPrice.Discountable': true
        }
    });

if (!tmpCompiled)
{
    console.error('Filter failed to compile');
    process.exit(1);
}

console.log('Required entities:', tmpCompiled.ParsedFilter.RequiredEntities);
// → ['Book', 'Author', 'BookPrice']

console.log('Request plan:');
for (let tmpRequest of tmpCompiled.Requests)
{
    console.log(`  ${tmpRequest.Entity}: ${tmpRequest.MeadowFilter}`);
    console.log(`    Chain: [${tmpRequest.GraphRequestChain.join(', ')}]`);
}
// Example output:
//   Author: FBV~IDAuthor~EQ~107
//     Chain: [BookAuthorJoin]
//   BookPrice: FBV~Discountable~EQ~true
//     Chain: []
```

## Code Example: Inspect the Solved Paths

```javascript
let tmpCompiled = _GraphClient.compileFilter(
    {
        Entity: 'Book',
        Filter: { 'Author.Name': 'Dan Brown' }
    });

console.log('Author path:');
console.log('  EdgeAddress:', tmpCompiled.RequestPaths.Author.OptimalSolutionPath.EdgeAddress);
console.log('  Weight:', tmpCompiled.RequestPaths.Author.OptimalSolutionPath.Weight);
console.log('  Hops:', tmpCompiled.RequestPaths.Author.OptimalSolutionPath.RequestPath.length);
// Example:
//   EdgeAddress: Book-->BookAuthorJoin-->Author
//   Weight: 99850
//   Hops: 3
```

`RequestPaths` contains one entry per required non-pivotal entity, each holding the full graph connection object returned by `solveGraphConnections`.

## The Pipeline

```
compileFilter(pFilterObject)
    │
    ├─► lintFilterObject(pFilterObject)
    │       (fill in defaults, validate)
    │
    ├─► parseFilterObject(pFilterObject)
    │       (group filter entries by entity, build expressions)
    │
    ├─► for each RequiredEntity ≠ pivotal:
    │       solveGraphConnections(pivotal, entity, hints)
    │       → store in RequestPaths[entity]
    │
    ├─► for each RequiredEntity ≠ pivotal:
    │       build Request object:
    │           Entity
    │           MeadowFilter = convertFilterObjectToFilterString(FilterExpressionSet[entity])
    │           GraphRequestChain = intermediate hops (not pivotal or endpoint)
    │
    └─► return compiled object
```

Each stage is a separate public method — you can replicate the pipeline manually if you need to intercept one of the stages.

## Code Example: Dry-Run Explain

```javascript
function explainQuery(pGraphClient, pFilterObject)
{
    let tmpCompiled = pGraphClient.compileFilter(pFilterObject);

    if (!tmpCompiled)
    {
        return { error: 'Filter failed to compile — check logs' };
    }

    let tmpExplanation =
        {
            pivotalEntity: tmpCompiled.ParsedFilter.Entity,
            entitiesToQuery: tmpCompiled.ParsedFilter.RequiredEntities,
            orderOfExecution: tmpCompiled.Requests.map((pReq, pIndex) => ({
                step: pIndex + 1,
                entity: pReq.Entity,
                meadowFilter: pReq.MeadowFilter,
                intermediateHops: pReq.GraphRequestChain
            })),
            paths: Object.fromEntries(
                Object.entries(tmpCompiled.RequestPaths).map(([pEntity, pConnection]) =>
                    [
                        pEntity,
                        {
                            edgeAddress: pConnection.OptimalSolutionPath
                                ? pConnection.OptimalSolutionPath.EdgeAddress
                                : 'NOT FOUND',
                            weight: pConnection.OptimalSolutionPath
                                ? pConnection.OptimalSolutionPath.Weight
                                : null
                        }
                    ])
            )
        };

    return tmpExplanation;
}

console.log(JSON.stringify(
    explainQuery(_GraphClient,
        {
            Entity: 'Book',
            Filter:
            {
                'Author.Name': 'Dan Brown',
                'BookPrice.Discountable': true
            }
        }),
    null, 2));
```

## Error Handling

`compileFilter` returns `false` if:

- The filter object failed `lintFilterObject` validation (not an object, missing `Entity`)

It will *not* return `false` if individual filter expressions fail to build (`buildFilterExpression` returned `false` for unknown entities/columns). Those failures are logged but the compile continues with whatever expressions did succeed. Check the log output if the resulting plan doesn't include expressions you expected.

## What `Requests` Excludes

The compiled `Requests` array only includes entries for **non-pivotal** required entities. The pivotal entity's request is handled separately by `get()` as the final step after all downstream data has been gathered. If you're running the plan manually (not via `get()`), remember to do a final request for the pivotal entity using its own filter expressions and the accumulated constraints from the downstream results.

## Related

- [get](api-get.md) — the full execute path that calls `compileFilter` and then runs the plan
- [parseFilterObject](api-parseFilterObject.md) — the stage that populates `ParsedFilter`
- [solveGraphConnections](api-solveGraphConnections.md) — the stage that populates `RequestPaths`
- [convertFilterObjectToFilterString](api-convertFilterObjectToFilterString.md) — the helper that emits the `MeadowFilter` strings
