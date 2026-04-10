# lintFilterObject

Validate a filter object and fill in default values for missing fields. `lintFilterObject` is called automatically by `compileFilter` before any real work happens, but it's exposed publicly so you can pre-validate filter objects yourself.

## Signature

```javascript
lintFilterObject(pFilterObject)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pFilterObject` | object | A filter object to validate. Must at minimum have an `Entity` field. |

**Returns:** `true` if the filter object is valid (and has been mutated to fill in defaults), `false` if validation failed (the argument is not an object or is missing `Entity`).

**Side effects:** mutates the argument in place -- adds `Filter: {}` if missing, adds `Options` with default `RecordLimit: 10000` and `PageSize: 100` if missing.

## When to Use It

Use `lintFilterObject` directly when:

- You want to sanitize a user-supplied filter object from an HTTP request body before passing it deeper into your code
- You want to catch invalid filters early with a cheap check that doesn't require schema knowledge
- You're writing a higher-level wrapper that needs to add its own defaults on top of the linted ones

In most production code paths, `compileFilter` and `get` call `lintFilterObject` for you.

## Code Example

```javascript
let tmpFilter =
    {
        Entity: 'Book'
        // Filter and Options intentionally missing
    };

let tmpIsValid = _GraphClient.lintFilterObject(tmpFilter);
console.log(tmpIsValid);
// -> true

console.log(tmpFilter);
// ->
// {
//     Entity: 'Book',
//     Filter: {},
//     Options: { RecordLimit: 10000, PageSize: 100 }
// }
```

## Validation Rules

| Check | Action on Failure |
|-------|-------------------|
| Argument is an object | Logs error `The filter object is not an object.` and returns `false` |
| Has `Entity` field | Logs error `The filter object does not have an Entity property.` and returns `false` |
| Has `Filter` field | Logs error (the message says "error" but behaviour is permissive), adds empty `Filter: {}`, continues |
| Has `Options` field | Silently adds `Options: {}`, continues |
| `Options.RecordLimit` present | Adds `RecordLimit: 10000` if missing |
| `Options.PageSize` present | Adds `PageSize: 100` if missing |

## Code Example: Defensive Use

```javascript
function safelyCompileFilter(pGraphClient, pUserFilter)
{
    // Clone first so we don't mutate user input
    let tmpFilter = JSON.parse(JSON.stringify(pUserFilter));

    if (!pGraphClient.lintFilterObject(tmpFilter))
    {
        return null;
    }

    return pGraphClient.compileFilter(tmpFilter);
}

// Usage
let tmpResult = safelyCompileFilter(_GraphClient,
    {
        Entity: 'Book',
        Filter: { 'Author.IDAuthor': 107 }
    });

if (!tmpResult)
{
    console.error('Filter failed linting');
}
else
{
    console.log('Request plan:', tmpResult.Requests);
}
```

## Code Example: Pre-Validating HTTP Bodies

```javascript
// Express-style route handler
app.post('/api/graph/query', (pRequest, pResponse) =>
{
    let tmpFilter = pRequest.body;

    if (!_GraphClient.lintFilterObject(tmpFilter))
    {
        pResponse.status(400).json({ error: 'Invalid filter object' });
        return;
    }

    _GraphClient.get(tmpFilter, (pError, pResult) =>
    {
        if (pError)
        {
            pResponse.status(500).json({ error: pError.message });
            return;
        }
        pResponse.json(pResult);
    });
});
```

## Customizing Defaults

The default `RecordLimit` and `PageSize` values are hard-coded in the linter. If you want per-request customization, set them on the filter object before calling `lintFilterObject`:

```javascript
let tmpFilter =
    {
        Entity: 'Book',
        Filter: { 'Author.IDAuthor': 107 },
        Options: { RecordLimit: 500 }
        // PageSize will still default to 100
    };

_GraphClient.lintFilterObject(tmpFilter);
console.log(tmpFilter.Options);
// -> { RecordLimit: 500, PageSize: 100 }
```

## Related

- [parseFilterObject](api-parseFilterObject.md) -- the next stage, which turns the linted object into a canonical form
- [compileFilter](api-compileFilter.md) -- the full pipeline that calls `lintFilterObject` automatically
- [Filter DSL Reference](filter-dsl.md) -- every shape a filter can take
