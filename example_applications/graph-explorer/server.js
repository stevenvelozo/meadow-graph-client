/**
 * Meadow Graph Explorer Server
 *
 * A simple HTTP server that:
 * 1. Serves static files from public/
 * 2. Uses meadow-graph-client to solve entity graph paths
 * 3. Proxies data requests to a running retold-harness instance
 */

const libHTTP = require('http');
const libPath = require('path');
const libFS = require('fs');
const libURL = require('url');

const libFable = require('fable');
const libMeadowGraphClient = require('../../source/Meadow-Graph-Client.js');

const modelBookStore = require('./model/Retold-Bookstore-Full.json');

const HARNESS_HOST = process.env.HARNESS_HOST || 'localhost';
const HARNESS_PORT = process.env.HARNESS_PORT || 8086;
const SERVER_PORT = process.env.PORT || 3420;

// --- Initialize Fable and Graph Client ---
let _Fable = new libFable({ LogLevel: 3 });
_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
let _GraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', { DataModel: modelBookStore });
_GraphClient.cleanMissingEntityConnections();

console.log(`Meadow Graph Explorer`);
console.log(`  Loaded ${Object.keys(_GraphClient._KnownEntities).length} entities into the graph.`);
console.log(`  Harness target: http://${HARNESS_HOST}:${HARNESS_PORT}`);

// --- MIME Types ---
const MIME_TYPES = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml'
};

// --- Helpers ---
function sendJSON(pResponse, pStatusCode, pData)
{
	pResponse.writeHead(pStatusCode, { 'Content-Type': 'application/json' });
	pResponse.end(JSON.stringify(pData));
}

function readBody(pRequest, fCallback)
{
	let tmpBody = '';
	pRequest.on('data', (pChunk) => { tmpBody += pChunk; });
	pRequest.on('end', () =>
	{
		try
		{
			fCallback(null, JSON.parse(tmpBody));
		}
		catch (pError)
		{
			fCallback(pError, null);
		}
	});
}

function serveStaticFile(pFilePath, pResponse)
{
	let tmpExtension = libPath.extname(pFilePath);
	let tmpMimeType = MIME_TYPES[tmpExtension] || 'application/octet-stream';

	libFS.readFile(pFilePath, (pError, pData) =>
	{
		if (pError)
		{
			pResponse.writeHead(404);
			pResponse.end('Not Found');
			return;
		}
		pResponse.writeHead(200, { 'Content-Type': tmpMimeType });
		pResponse.end(pData);
	});
}

function proxyToHarness(pPath, pResponse)
{
	let tmpOptions = {
		hostname: HARNESS_HOST,
		port: HARNESS_PORT,
		path: `/1.0/${pPath}`,
		method: 'GET',
		headers: { 'Accept': 'application/json' }
	};

	let tmpProxyReq = libHTTP.request(tmpOptions, (pProxyRes) =>
	{
		let tmpData = '';
		pProxyRes.on('data', (pChunk) => { tmpData += pChunk; });
		pProxyRes.on('end', () =>
		{
			pResponse.writeHead(pProxyRes.statusCode, {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*'
			});
			pResponse.end(tmpData);
		});
	});

	tmpProxyReq.on('error', (pError) =>
	{
		sendJSON(pResponse, 502, { Error: `Could not reach harness: ${pError.message}` });
	});

	tmpProxyReq.end();
}

// --- API Handlers ---
function handleGetModel(pResponse)
{
	let tmpEntities = {};
	let tmpEntityNames = Object.keys(_GraphClient._KnownEntities);

	for (let i = 0; i < tmpEntityNames.length; i++)
	{
		let tmpEntityName = tmpEntityNames[i];
		let tmpColumns = Object.keys(_GraphClient._KnownEntities[tmpEntityName]);
		let tmpOutgoing = _GraphClient._OutgoingEntityConnections[tmpEntityName] || {};
		let tmpIncoming = _GraphClient._IncomingEntityConnections[tmpEntityName] || {};

		tmpEntities[tmpEntityName] = {
			Columns: tmpColumns,
			OutgoingConnections: tmpOutgoing,
			IncomingConnections: tmpIncoming
		};
	}

	sendJSON(pResponse, 200, {
		Entities: tmpEntities,
		EntityNames: tmpEntityNames,
		OutgoingConnections: _GraphClient._OutgoingEntityConnections,
		IncomingConnections: _GraphClient._IncomingEntityConnections
	});
}

function handleSolve(pRequest, pResponse)
{
	readBody(pRequest, (pError, pBody) =>
	{
		if (pError || !pBody || !pBody.From || !pBody.To)
		{
			return sendJSON(pResponse, 400, { Error: 'Request body must include From and To entity names.' });
		}

		if (!(pBody.From in _GraphClient._KnownEntities))
		{
			return sendJSON(pResponse, 400, { Error: `Unknown source entity: ${pBody.From}` });
		}
		if (!(pBody.To in _GraphClient._KnownEntities))
		{
			return sendJSON(pResponse, 400, { Error: `Unknown destination entity: ${pBody.To}` });
		}

		let tmpHints = Array.isArray(pBody.Hints) ? pBody.Hints : [];
		let tmpResult = _GraphClient.solveGraphConnections(pBody.From, pBody.To, tmpHints);

		// Extract a clean result
		let tmpSolutions = tmpResult.PotentialSolutions.map((pSolution) =>
		{
			return {
				Weight: pSolution.Weight,
				HintWeight: pSolution.HintWeight,
				EdgeAddress: pSolution.EdgeAddress,
				RequestPath: pSolution.RequestPath.map((pStep) =>
				{
					return {
						Entity: pStep.Entity,
						Depth: pStep.Depth,
						FilterValueColumn: pStep.FilterValueColumn || null,
						FilterSourceDataSet: pStep.FilterSourceDataSet || null
					};
				})
			};
		});

		let tmpOptimal = tmpResult.OptimalSolutionPath ? {
			Weight: tmpResult.OptimalSolutionPath.Weight,
			EdgeAddress: tmpResult.OptimalSolutionPath.EdgeAddress
		} : null;

		sendJSON(pResponse, 200, {
			From: pBody.From,
			To: pBody.To,
			Hints: tmpHints,
			SolutionCount: tmpSolutions.length,
			OptimalSolution: tmpOptimal,
			Solutions: tmpSolutions
		});
	});
}

function handleCompile(pRequest, pResponse)
{
	readBody(pRequest, (pError, pBody) =>
	{
		if (pError || !pBody || !pBody.Entity)
		{
			return sendJSON(pResponse, 400, { Error: 'Request body must include an Entity and Filter.' });
		}

		let tmpFilterObject = {
			Entity: pBody.Entity,
			Filter: pBody.Filter || {},
			Hints: pBody.Hints || []
		};

		let tmpResult = _GraphClient.compileFilter(tmpFilterObject);

		if (!tmpResult)
		{
			return sendJSON(pResponse, 400, { Error: 'Could not compile the filter. Check entity and column names.' });
		}

		// Extract a serializable result
		let tmpRequests = tmpResult.Requests.map((pRequest) =>
		{
			return {
				Entity: pRequest.Entity,
				MeadowFilter: pRequest.MeadowFilter,
				GraphRequestChain: pRequest.GraphRequestChain
			};
		});

		let tmpRequestPaths = {};
		for (let tmpKey in tmpResult.RequestPaths)
		{
			let tmpPath = tmpResult.RequestPaths[tmpKey];
			tmpRequestPaths[tmpKey] = {
				SolutionCount: tmpPath.PotentialSolutions ? tmpPath.PotentialSolutions.length : 0,
				OptimalPath: tmpPath.OptimalSolutionPath ? tmpPath.OptimalSolutionPath.EdgeAddress : null
			};
		}

		sendJSON(pResponse, 200, {
			Entity: pBody.Entity,
			Filter: pBody.Filter,
			Requests: tmpRequests,
			RequestPaths: tmpRequestPaths,
			RequiredEntities: tmpResult.ParsedFilter.RequiredEntities
		});
	});
}

// --- HTTP Server ---
let tmpServer = libHTTP.createServer((pRequest, pResponse) =>
{
	let tmpParsedURL = libURL.parse(pRequest.url, true);
	let tmpPath = tmpParsedURL.pathname;

	// API routes
	if (tmpPath === '/api/model' && pRequest.method === 'GET')
	{
		return handleGetModel(pResponse);
	}
	if (tmpPath === '/api/solve' && pRequest.method === 'POST')
	{
		return handleSolve(pRequest, pResponse);
	}
	if (tmpPath === '/api/compile' && pRequest.method === 'POST')
	{
		return handleCompile(pRequest, pResponse);
	}
	if (tmpPath.startsWith('/api/proxy/'))
	{
		let tmpProxyPath = tmpPath.substring('/api/proxy/'.length);
		return proxyToHarness(tmpProxyPath, pResponse);
	}

	// Static files
	let tmpFilePath = libPath.join(__dirname, 'public', tmpPath === '/' ? 'index.html' : tmpPath);
	serveStaticFile(tmpFilePath, pResponse);
});

tmpServer.listen(SERVER_PORT, () =>
{
	console.log(`\n  Graph Explorer running at http://localhost:${SERVER_PORT}`);
	console.log(`  Press Ctrl+C to stop.\n`);
});
