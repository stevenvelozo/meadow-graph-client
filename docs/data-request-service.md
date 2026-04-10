# Data Request Service

Meadow Graph Client doesn't ship with a built-in HTTP client. Instead, it defines a tiny service interface -- `MeadowGraphDataRequest` -- with overrideable template methods for `getJSON`, `postJSON`, and `putJSON`, and delegates every outbound call to whichever implementation you've registered with Fable. This page explains how to plug in your own transport.

## Why This Design

The graph client can run in wildly different environments:

- **Node.js HTTP** -- calling a remote meadow-endpoints server
- **Node.js HTTPS** -- same thing with TLS, client auth, or self-signed certs
- **In-process** -- skipping the network entirely and calling meadow directly
- **Browser** -- using `fetch` or `XMLHttpRequest`
- **Test fakes** -- returning canned records to drive unit tests

Bundling an HTTP client would force a dependency on every consumer and still not cover all four cases. The stub-and-override pattern keeps the package footprint tiny and lets each consumer choose exactly the transport they need.

## The Default Stub

The module ships with `source/Meadow-Graph-Service-DataRequest.js`, which extends `fable-serviceproviderbase` and exposes three template-method pairs:

```
getJSON  -> onBeforeGetJSON  -> doGetJSON  -> onAfterGetJSON  -> fCallback
postJSON -> onBeforePostJSON -> doPostJSON -> onAfterPostJSON -> fCallback
putJSON  -> onBeforePutJSON  -> doPutJSON  -> onAfterPutJSON  -> fCallback
```

The `do*JSON` methods are stubs that simply call `fCallback(null, null)` -- they don't actually make a request. You override them with real transport logic. The `onBefore*` / `onAfter*` hooks are also overrideable for cross-cutting concerns like auth, logging, retries, or tracing.

## Method Surface

### Controller Methods (Don't Override These)

```javascript
getJSON(pURL, fCallback)
postJSON(pURL, pRequestPostObject, fCallback)
putJSON(pURL, pRequestPutObject, fCallback)
```

These are the methods the graph client itself calls. They chain the before/do/after hooks together in the right order. **Override the inner hooks, not these.**

### Transport Methods (Override These)

```javascript
doGetJSON(pURL, fCallback)                          // Perform the actual GET
doPostJSON(pURL, pRequestPostObject, fCallback)     // Perform the actual POST
doPutJSON(pURL, pRequestPutObject, fCallback)       // Perform the actual PUT
```

Each takes a URL (and a body for POST/PUT) and calls `fCallback(pError, pResponseData)` when the request completes.

### Hook Methods (Override for Cross-Cutting Concerns)

```javascript
onBeforeGetJSON(pURL, fCallback)
onAfterGetJSON(pURL, pError, pResponse, fCallback)

onBeforePostJSON(pURL, pRequestPostObject, fCallback)
onAfterPostJSON(pURL, pRequestPostObject, pError, pResponse, fCallback)

onBeforePutJSON(pURL, pRequestPutObject, fCallback)
onAfterPutJSON(pURL, pRequestPutObject, pError, pResponse, fCallback)
```

Use these to inject headers, add tracing, log requests, implement retries, or mutate the response before the graph client sees it.

## Pattern 1: Subclass and Override

The most common pattern is to subclass `MeadowGraphDataRequest` and override `doGetJSON` (and usually `doPostJSON`/`doPutJSON`):

```javascript
const libMeadowGraphDataRequest = require('meadow-graph-client/source/Meadow-Graph-Service-DataRequest.js');
const libHTTPS = require('https');
const libURL = require('url');

class HTTPSGraphDataRequest extends libMeadowGraphDataRequest
{
    doGetJSON(pURL, fCallback)
    {
        let tmpParsed = libURL.parse(pURL);
        let tmpOptions =
            {
                host: tmpParsed.host,
                path: tmpParsed.path,
                method: 'GET',
                headers:
                {
                    'Accept': 'application/json',
                    'User-Agent': 'meadow-graph-client/1.0'
                }
            };

        let tmpRequest = libHTTPS.request(tmpOptions, (pResponse) =>
        {
            let tmpChunks = [];
            pResponse.on('data', (pChunk) => tmpChunks.push(pChunk));
            pResponse.on('end', () =>
            {
                try
                {
                    let tmpBody = Buffer.concat(tmpChunks).toString('utf8');
                    return fCallback(null, JSON.parse(tmpBody));
                }
                catch (pError)
                {
                    return fCallback(pError, null);
                }
            });
        });

        tmpRequest.on('error', (pError) => fCallback(pError, null));
        tmpRequest.end();
    }

    doPostJSON(pURL, pRequestPostObject, fCallback)
    {
        let tmpBody = JSON.stringify(pRequestPostObject);
        let tmpParsed = libURL.parse(pURL);
        let tmpOptions =
            {
                host: tmpParsed.host,
                path: tmpParsed.path,
                method: 'POST',
                headers:
                {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(tmpBody)
                }
            };

        let tmpRequest = libHTTPS.request(tmpOptions, (pResponse) =>
        {
            let tmpChunks = [];
            pResponse.on('data', (pChunk) => tmpChunks.push(pChunk));
            pResponse.on('end', () =>
            {
                try
                {
                    return fCallback(null, JSON.parse(Buffer.concat(tmpChunks).toString('utf8')));
                }
                catch (pError)
                {
                    return fCallback(pError, null);
                }
            });
        });

        tmpRequest.on('error', (pError) => fCallback(pError, null));
        tmpRequest.write(tmpBody);
        tmpRequest.end();
    }
}

module.exports = HTTPSGraphDataRequest;
module.exports.default_configuration = {};
```

Register it with Fable before instantiating the graph client:

```javascript
const libFable = require('fable');
const libMeadowGraphClient = require('meadow-graph-client');
const HTTPSGraphDataRequest = require('./HTTPSGraphDataRequest.js');

const _Fable = new libFable();

// Register the transport under the default service name
_Fable.addAndInstantiateSingletonService(
    'MeadowGraphClientDataRequest',
    HTTPSGraphDataRequest.default_configuration,
    HTTPSGraphDataRequest);

// Now create the graph client
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema
    });

// Queries will now use HTTPSGraphDataRequest
_GraphClient.get(myFilterObject, (pError, pResult) => {
    // ...
});
```

## Pattern 2: Alternate Service Name

If you want to keep the default stub around and plug in a second transport alongside it, register your transport under a different name and tell the graph client to use it via the `DataRequestClientService` option:

```javascript
_Fable.addAndInstantiateSingletonService('HTTPSGraphDataRequest', {}, HTTPSGraphDataRequest);

let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient',
    {
        DataModel: mySchema,
        DataRequestClientService: 'HTTPSGraphDataRequest'
    });
```

Useful when:

- You have multiple graph clients in the same app, each targeting a different backend
- You want to swap transports based on config without changing class registration order

## Pattern 3: Fetch-Based Browser Transport

```javascript
const libMeadowGraphDataRequest = require('meadow-graph-client/source/Meadow-Graph-Service-DataRequest.js');

class FetchGraphDataRequest extends libMeadowGraphDataRequest
{
    doGetJSON(pURL, fCallback)
    {
        fetch(pURL, { headers: { 'Accept': 'application/json' } })
            .then((pResponse) => pResponse.json())
            .then((pData) => fCallback(null, pData))
            .catch((pError) => fCallback(pError, null));
    }

    doPostJSON(pURL, pRequestPostObject, fCallback)
    {
        fetch(pURL,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pRequestPostObject)
            })
            .then((pResponse) => pResponse.json())
            .then((pData) => fCallback(null, pData))
            .catch((pError) => fCallback(pError, null));
    }

    doPutJSON(pURL, pRequestPutObject, fCallback)
    {
        fetch(pURL,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pRequestPutObject)
            })
            .then((pResponse) => pResponse.json())
            .then((pData) => fCallback(null, pData))
            .catch((pError) => fCallback(pError, null));
    }
}
```

## Pattern 4: Adding Auth Headers

Use the `onBefore*` hooks to inject auth headers without rewriting the transport logic:

```javascript
class AuthenticatedHTTPSGraphDataRequest extends HTTPSGraphDataRequest
{
    constructor(pFable, pManifest, pServiceHash)
    {
        super(pFable, pManifest, pServiceHash);
        this.authToken = process.env.GRAPH_AUTH_TOKEN || '';
    }

    onBeforeGetJSON(pURL, fCallback)
    {
        this.log.trace(`GET ${pURL}`);
        // You can't easily add headers to the stock doGetJSON above,
        // so the auth injection has to happen inside doGetJSON itself.
        // A cleaner pattern is to store the token on the instance and
        // have doGetJSON read it.
        return fCallback();
    }

    doGetJSON(pURL, fCallback)
    {
        let tmpParsed = libURL.parse(pURL);
        let tmpOptions =
            {
                host: tmpParsed.host,
                path: tmpParsed.path,
                method: 'GET',
                headers:
                {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`    // <- injected here
                }
            };

        // ... rest of the HTTP handling from HTTPSGraphDataRequest
    }
}
```

## Pattern 5: Test Fake

For tests, you usually want a deterministic transport that returns canned responses based on the URL:

```javascript
class FakeGraphDataRequest extends libMeadowGraphDataRequest
{
    constructor(pFable, pManifest, pServiceHash)
    {
        super(pFable, pManifest, pServiceHash);
        this.responses = new Map();    // URL -> response data
        this.callLog = [];              // record every call for assertions
    }

    setResponse(pURL, pData)
    {
        this.responses.set(pURL, pData);
    }

    doGetJSON(pURL, fCallback)
    {
        this.callLog.push({ method: 'GET', url: pURL });
        if (this.responses.has(pURL))
        {
            return fCallback(null, this.responses.get(pURL));
        }
        return fCallback(new Error(`No canned response for ${pURL}`), null);
    }

    doPostJSON(pURL, pBody, fCallback)
    {
        this.callLog.push({ method: 'POST', url: pURL, body: pBody });
        return fCallback(null, { success: true });
    }

    doPutJSON(pURL, pBody, fCallback)
    {
        this.callLog.push({ method: 'PUT', url: pURL, body: pBody });
        return fCallback(null, { success: true });
    }
}

// In the test:
let _FakeDataRequest = new FakeGraphDataRequest(_Fable);
_FakeDataRequest.setResponse(
    'http://localhost/Authors/FilteredTo/FBV~IDAuthor~EQ~107/0/10000',
    [{ IDAuthor: 107, Name: 'Dan Brown' }]);
```

## URLs Produced by the Graph Client

The current implementation's internal helper (`gatherConnectedEntityData`) constructs URLs in this format:

```
{EntityToGather}s/FilteredTo/{MeadowFilter}/0/10000
```

For example:

```
Authors/FilteredTo/FBV~IDAuthor~EQ~107/0/10000
```

The URL is relative; your transport is responsible for prepending the base URL (whether hardcoded, from environment, or from Fable settings). See the [meadow-endpoints](https://github.com/stevenvelozo/meadow-endpoints) documentation for the full URL format meadow-endpoints servers accept.

## Before / After Hook Signatures (Reference)

```javascript
onBeforeGetJSON(pURL, fCallback)                    // fCallback()
onAfterGetJSON(pURL, pError, pResponse, fCallback)  // fCallback(pError, pResponse)

onBeforePostJSON(pURL, pBody, fCallback)                    // fCallback()
onAfterPostJSON(pURL, pBody, pError, pResponse, fCallback)  // fCallback(pError, pResponse)

onBeforePutJSON(pURL, pBody, fCallback)                     // fCallback()
onAfterPutJSON(pURL, pBody, pError, pResponse, fCallback)   // fCallback(pError, pResponse)
```

All `onBefore*` hooks take a no-argument callback (just `fCallback()`). All `onAfter*` hooks forward `(pError, pResponse)` and get a chance to mutate both before the caller sees them.

## Related

- [get](api-get.md) -- the method that ultimately calls your transport
- [compileFilter](api-compileFilter.md) -- builds the URLs that go into `doGetJSON`
- [Configuration Reference § Data Request Service](configuration.md#data-request-service) -- the `DataRequestClientService` option
