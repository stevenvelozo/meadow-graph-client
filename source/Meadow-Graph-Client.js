const libFableServiceProviderBase = require('fable-serviceproviderbase');

const libGraphClientDataRequest = require('./Meadow-Graph-Service-DataRequest.js');

const _DefaultGraphClientConfiguration = (
	{
		// This allows us to point the graph client at a different http request
		// client (e.g. a platform-specific client) if one already exists in the
		// fable services.
		"DataRequestClientService": "MeadowGraphClientDataRequest",

		// The maximum number of hops we allow the graph solver to traverse before it gives up
		"MaximumTraversalDepth": 25,

		// The Weights for Graph Path Evaluation
		"StartingWeight": 100000,

		// The Weight for a hinted table in the chain (e.g. if we want to hint a join)
		// This is meant to be much higher than the starting weight, to make a single (or even multiple) hinted tables blast routes to the top.
		"HintWeight": 200000,

		// What to add per depth
		"TraversalHopWeight": -100,

		// What to add if a direct outgoing join exists
		"OutgoingJoinWeight": 25,

		// What to add if the word "Join" is in the external table name
		// Joins to Joins is valid, and, an odd one.... can work (and accelerate the traversal) .... which can be used to great advantage.........
		"JoinInTableNameWeight": 25,

		// Any default manual paths to load on initialization
		"DefaultManualPaths": {},

		// Any default hints to load on initialization
		"DefaultHints": {}
	});

/**
 * Class representing a Meadow Graph Client.
 * @extends libFableServiceProviderBase
 */
class MeadowGraphClient extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, JSON.parse(JSON.stringify(_DefaultGraphClientConfiguration)), pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowGraphClient';

		this.fable.addAndInstantiateSingletonService(this.options.DataRequestClientService, libGraphClientDataRequest.default_configuration, libGraphClientDataRequest);

		// Map of joins (Entity->Other Entities)
		this._OutgoingEntityConnections = {};
		// Map of incoming connections for Entities (Entity->Incoming Entities)
		this._IncomingEntityConnections = {};

		// Map of solved joins so we don't solve them every time... ostensibly other than hints these are solvable.
		// Well, if a developer decides to use this dynamically and add/remove joins at runtime it could break
		// these paths.
		// TODO: Discuss if we want this to be a living/breathing data model or just a static needs to reload
		this._GraphSolutionMap = {};

		// Known Entities (loaded into the data model)
		this._KnownEntities = {};

		// Used for the parameter uniqeueness autonumber later -- we will want to auto reset this every once in a while;
		// the filter will have a *potential* bug if we wrap over the integer boundary and the Entities match data type
		// but that would be absurd and problematic and out of scope for this design.
		this._ParameterIndex = 0;

		// These are default manual paths to take.  They use the syntax of EdgeTraversalEndpoints which is a string
		// with the `PrimaryEntity->DestinationEntity` format.  This allows a developer to define manual routes with
		// custom filter expressions.  This is useful for complex joins that are not easily solved by the graph solver
		// that only uses ID columns, when we want to join across other data.
		//
		// These manual paths are required to be in the entity graph path format.
		this._DefaultManualPaths = (typeof (this.options.DefaultManualPaths) === 'object') ? this.options.DefaultManualPaths : {};

		// Hints are array of strings based on EdgeTraverslEndpoints syntax.
		this._DefaultHints = (typeof (this.options.DefaultHints) === 'object') ? this.options.DefaultHints : {};

		if (this.options.DataModel)
		{
			this.loadDataModel(this.options.DataModel);
		}
	}

	/**
	 * Adds an outgoing connection data model graph.
	 */
	addOutgoingConnection(pColumn, pConnectionFromEntity, pConnectionToEntity)
	{
		if (!this._OutgoingEntityConnections.hasOwnProperty(pConnectionFromEntity))
		{
			this._OutgoingEntityConnections[pConnectionFromEntity] = {};
		}

		if (!this._OutgoingEntityConnections[pConnectionFromEntity].hasOwnProperty(pConnectionToEntity))
		{
			this._OutgoingEntityConnections[pConnectionFromEntity][pConnectionToEntity] = pColumn;
		}
		else
		{
			// There are times when an entity refers to itself.  And.  Times when an entity is joined multiple times.
			// TODO: We should refine this to deal with that in a sane way.
			this.log.warn(`Meadow Graph Client: There is already a join for ${pConnectionFromEntity} from ${pConnectionToEntity}; connection will be ignored for ${pColumn}.`);
		}
	}

	/**
	 * Adds an incoming connection to the graph.
	 */
	addIncomingConnection(pColumn, pConnectionToEntity, pConnectionFromEntity)
	{
		if (!this._IncomingEntityConnections.hasOwnProperty(pConnectionToEntity))
		{
			this._IncomingEntityConnections[pConnectionToEntity] = {};
		}
		if (!this._IncomingEntityConnections[pConnectionToEntity].hasOwnProperty(pConnectionFromEntity))
		{
			this._IncomingEntityConnections[pConnectionToEntity][pConnectionFromEntity] = pColumn;
		}
		else
		{
			// There are times when an entity refers to itself.  And.  Times when an entity is joined multiple times.
			// We should refine this to deal with that in a sane way.
			this.log.warn(`Meadow Graph Client: There is already a reverse join for ${pConnectionToEntity} from ${pConnectionFromEntity}; connection will be ignored for ${pColumn}.`);
		}
	}

	/**
	 * Adds a Entity to the data model.
	 * 
	 * @param {object} pEntity - The Entity object to be added (meadow schema format).
	 * @returns {boolean} - Returns true if the Entity is successfully added, false otherwise.
	 */
	addEntityToDataModel(pEntity)
	{
		let tmpEntityName = pEntity.TableName;
		if (!pEntity.hasOwnProperty('Columns'))
		{
			this.log.error(`Meadow Graph Client: Could not add Entity to the data model because it does not have a Columns property.`);
			return false;
		}
		if (!Array.isArray(pEntity.Columns))
		{
			this.log.error(`Meadow Graph Client: Could not add Entity to the data model because the Columns property is not an array.`);
			return false;
		}
		if (this._KnownEntities.hasOwnProperty())
		{
			this.log.warn(`Meadow Graph Client: The Entity ${tmpEntityName} is already known; it won't be added to the graph.`);
			return false;
		}
		else
		{
			this._KnownEntities[tmpEntityName] = {};
		}
		if (!this._OutgoingEntityConnections.hasOwnProperty(tmpEntityName))
		{
			this._OutgoingEntityConnections[tmpEntityName] = {};
		}
		if (!this._IncomingEntityConnections.hasOwnProperty(tmpEntityName))
		{
			this._IncomingEntityConnections[tmpEntityName] = {};
		}

		for (let i = 0; i < pEntity.Columns.length; i++)
		{
			// Generate a basic map of the columns, for use in lookup later
			this._KnownEntities[tmpEntityName][pEntity.Columns[i].Column] = pEntity.Columns[i];

			// TODO: Potentially create a secondary set of graph connections across these audit joins, although they are really star/spokes as opposed to directed graphs.
			if (pEntity.Columns[i].Join &&
				pEntity.Columns[i].Column != 'IDCustomer' &&
				pEntity.Columns[i].Column != 'CreatingIDUser' &&
				pEntity.Columns[i].Column != 'UpdatingIDUser' &&
				pEntity.Columns[i].Column != 'DeletingIDUser')
			{
				let tmpConnectedEntityName = pEntity.Columns[i].Join.startsWith('ID') ? pEntity.Columns[i].Join.substring(2) : pEntity.Columns[i].Join;
				this.addIncomingConnection(pEntity.Columns[i].Column, tmpConnectedEntityName, pEntity.TableName);
				this.addOutgoingConnection(pEntity.Columns[i].Column, pEntity.TableName, tmpConnectedEntityName);
			}
		}
		return true;
	}

	/**
	 * Loads a data model into the Meadow Graph Client.
	 * 
	 * @param {object} pDataModel - The data model to be loaded.
	 * @returns {boolean} - Returns true if the data model was successfully loaded, false otherwise.
	 */
	loadDataModel(pDataModel)
	{
		let tmpDataModel = (typeof (pDataModel) == 'object') ? pDataModel : false;
		if (!tmpDataModel)
		{
			this.log.error(`Meadow Graph Client: Could not load a DataModel because it was not passed in or set in the options.`);
			return false;
		}
		if ((!tmpDataModel.hasOwnProperty('Tables')) || (typeof (tmpDataModel) != 'object'))
		{
			this.log.error(`Meadow Graph Client: The DataModel object does not have a Tables property or it is not an object, so cannot be loaded.`);
			return false;
		}
		// Enumerate each data set in the data model and create a join lookup if it isn't an internal audit column
		let tmpEntities = Object.keys(tmpDataModel.Tables);
		for (let i = 0; i < tmpEntities.length; i++)
		{
			let tmpEntity = tmpDataModel.Tables[tmpEntities[i]];
			this.addEntityToDataModel(tmpEntity);
		}
		return true;
	}

	/**
	 * Lints a passed-in filter object.
	 * 
	 * @param {object} pFilterObject - The filter object to be linted.
	 * @returns {boolean} - Returns true if the filter object is valid, false otherwise.
	 */
	lintFilterObject(pFilterObject)
	{
		// Check Javascript Types and that we have the bare minimum
		if (typeof (pFilterObject) !== 'object')
		{
			this.log.error(`Meadow Graph Client: The filter object is not an object.`);
			return false;
		}
		if (!pFilterObject.hasOwnProperty('Entity'))
		{
			this.log.error(`Meadow Graph Client: The filter object does not have an Entity property.`);
			return false;
		}
		if (!pFilterObject.hasOwnProperty('Filter'))
		{
			this.log.error(`Meadow Graph Client: The filter object does not have a Filter property.  Adding an empty filter.`);
			pFilterObject.Filter = {};
		}
		if (!pFilterObject.hasOwnProperty('Options'))
		{
			//this.log.error(`Meadow Graph Client: The filter object does not have an Options property.  Adding an empty options object.`);
			pFilterObject.Options = {};
		}

		// The RecordLimit option is the maximum number of records to return *FOR EACH ENTITY* in the query
		if (!pFilterObject.Options.hasOwnProperty('RecordLimit'))
		{
			// Limit this to 10,000 records for now -- we may want to increase this though :/
			pFilterObject.Options.RecordLimit = 10000;
		}
		if (!pFilterObject.Options.hasOwnProperty('PageSize'))
		{
			pFilterObject.Options.PageSize = 100;
		}

		return true;
	}

	/**
	 * Sets the default comparison operator for filter expressions based on data type
	 * @param {string} pDataType - The data type for the filter expression
	 * @returns {string} - The default Operator for the query
	 */
	getDefaultFilterExpressionOperator(pDataType)
	{
		switch (pDataType)
		{
			case 'String':
			case 'Text':
				return 'LIKE';

			default:
				return '=';
		}
	}

	// TODO: This needs some data type magick and INN list magick
	getMeadowFilterType(pFilterConnector, pFilterOperator)
	{
		if (pFilterOperator === '(')
		{
			return 'FOP';
		}

		if (pFilterOperator === ')')
		{
			return 'FCP';
		}

		if (pFilterConnector === 'OR')
		{
			return 'FBVOR';
		}

		return 'FBV';
	}


	/**
	 * Take in a passed-in filter object or string and turn it into a consistent expression object.
	 * 
	 * Passed-in filters can be defined with strings, strings containing entity
	 * or an object (expected to conform to the standard already).

		Internally the filters follow the precisely same syntax as the meadow filters with an added Entity string and hinting for the Meadow filterstring type:
		{
			"MeadowFilterType": "FBV",
			"Entity": "Book",
			"Column": "Title",
			"Value": "James%",
			"Operator": "LIKE",
			"Connector": "AND",
			"Parameter": "BookTitle5"
		}
	 * 
	 * @param {string} pPivotalEntity 
	 * @param {string} pFilterKey 
	 * @param {Any} pFilterValue 
	 * @returns {Object} A valid internal filter object with Column, Operator, Value, Connector and Parameter
	 */
	buildFilterExpression(pPivotalEntity, pFilterKey, pFilterValue)
	{
		let tmpFilterExpression = {};

		if (typeof (pFilterKey) === 'string')
		{
			// If the FilterKey has a dot in it, this references a specific entity
			// Objects do not provide this convenience feature.. spell it out or don't, no in-between magic
			let tmpSeparator = pFilterKey.indexOf('.');
			if (tmpSeparator > 0)
			{
				tmpFilterExpression.Entity = pFilterKey.substring(0, tmpSeparator);
				tmpFilterExpression.Column = pFilterKey.substring(tmpSeparator + 1);
			}
			else
			{
				tmpFilterExpression.Entity = pPivotalEntity;
				tmpFilterExpression.Column = pFilterKey.substring(tmpSeparator);
			}
			tmpFilterExpression.Value = pFilterValue;
		}
		else if (typeof (pFilterKey) === 'object')
		{
			let tmpFilterExpression = pFilterKey;
			if (!('Entity' in tmpFilterExpression))
			{
				tmpFilterExpression.Entity = pPivotalEntity;
			}
			if (!('Value' in tmpFilterExpression))
			{
				this.log.error(`Manual filter expression object ${JSON.stringify(pFilterValue)} doesn't contain a Value property; skipping it.`);
				return false;
			}
		}

		if (!(tmpFilterExpression.Entity in this._KnownEntities))
		{
			this.log.error(`Filter expression for [${tmpFilterExpression.Entity}.${tmpFilterExpression.Column}] references unknown entity ${tmpFilterExpression.Entity}.`);
			// TODO: Throw?
			return false;
		}
		if (!(tmpFilterExpression.Column in this._KnownEntities[tmpFilterExpression.Entity]))
		{
			this.log.error(`Filter expression for [${tmpFilterExpression.Entity}.${tmpFilterExpression.Column}] references unknown Column ${tmpFilterExpression.Column}.`);
			// TODO: Throw?
			return false;
		}

		// Now that we've checked the value, entity and column... deal with the rest of the properties
		if (!('Operator' in tmpFilterExpression))
		{
			tmpFilterExpression.Operator = this.getDefaultFilterExpressionOperator(this._KnownEntities[tmpFilterExpression.Entity][tmpFilterExpression.Column].DataType);
		}
		if (!('Connector' in tmpFilterExpression))
		{
			tmpFilterExpression.Connector = 'And';
		}

		if (!('MeadowFilterType' in tmpFilterExpression))
		{
			tmpFilterExpression.MeadowFilterType = this.getMeadowFilterType(tmpFilterExpression.Connector, tmpFilterExpression.Operator);
		}

		return tmpFilterExpression;
	}

	/**
	 * Parses the filter object and returns valid filters.
	 *
	 * @param {Object} pFilterObject - The filter object to parse.
	 * @returns {Object} - A linted and valid filter object.
	 */
	parseFilterObject(pFilterObject)
	{
		let tmpFilterObject = { Entity:pFilterObject.Enttiy, SourceFilterObject:pFilterObject };

		// 1. Clean up any previous source filter objects; this is if we keep reusing the filter object over and over.
		if (tmpFilterObject.SourceFilterObject.hasOwnProperty('SourceFilterObject'))
		{
			delete tmpFilterObject.SourceFilterObject.SourceFilterObject;
		}

		// 2. Setup the basic entity filter expression set.
		//    This is used to determine which entities to solve for; the order people put filters in can steer this.
		tmpFilterObject.Entity = tmpFilterObject.SourceFilterObject.Entity;
		tmpFilterObject.FilterExpressionSet = {};

		// 3. Add an implicit set for the core entity
		tmpFilterObject.FilterExpressionSet[tmpFilterObject.Entity] = [];

		// 4. Enumerate the filters
		let tmpFilters = Object.keys(tmpFilterObject.SourceFilterObject.Filter);
		for (let i = 0; i < tmpFilters.length; i++)
		{
			let tmpFilterHash = tmpFilters[i];
			let tmpFilterExpression = this.buildFilterExpression(pFilterObject.Entity, tmpFilterHash, tmpFilterObject.SourceFilterObject.Filter[tmpFilterHash]);

			if (tmpFilterExpression)
			{
				if (!tmpFilterObject.FilterExpressionSet.hasOwnProperty(tmpFilterExpression.Entity))
				{
					tmpFilterObject.FilterExpressionSet[tmpFilterExpression.Entity] = [];
				}

				tmpFilterObject.FilterExpressionSet[tmpFilterExpression.Entity].push(tmpFilterExpression);
			}
		}

		tmpFilterObject.RequiredEntities = Object.keys(tmpFilterObject.FilterExpressionSet);

		// 5. Create a location in the Filter Object to store solutions
		tmpFilterObject.SolutionMap = {}

		return tmpFilterObject;
	}

	gatherConnectedEntityData(pEntityContainer, pEntityContainerHash, pDestinationEntityName, pDestinationIDEntity, pEntityToGather, fCallback)
	{
		let tmpFilter = `FBV~ID${pDestinationEntityName}~EQ~${pDestinationIDEntity}`;
		this.fable.HeadlightRestClient.getEntitiesetWithPages(pEntityToGather, tmpFilter,
			(pRecordCount) =>
			{
				//console.log(`Matched ${pRecordCount} ${pEntityToGather} for ${pDestinationEntity} [${pDestinationIDEntity}]`);
				let tmpRecordCount = pRecordCount > 0 ? pRecordCount : 1;
				if (pRecordCount < 1)
				{
					pSilent = true;
				}
				this.progressTracker.createProgressTracker(`${pEntityToGather}-Download-${pDestinationEntityName}-${pDestinationIDEntity}`, tmpRecordCount);
				this.progressTracker.startProgressTracker(`${pEntityToGather}-Download-${pDestinationEntityName}-${pDestinationIDEntity}`);
			},
			(pPageLength, pPageRecords) =>
			{
				this.progressTracker.incrementProgressTracker(`${pEntityToGather}-Download-${pDestinationEntityName}-${pDestinationIDEntity}`, pPageLength);
				if (!pSilent)
				{
					this.progressTracker.logProgressTrackerStatus(`${pEntityToGather}-Download-${pDestinationEntityName}-${pDestinationIDEntity}`);
				}
			},
			(pError, pRecords) =>
			{
				if (pError)
				{
					this.log.error(`Error getting ${pEntityToGather} records: ${pError}`, pError);
				}
				//console.log(`...decorated ${pRecords.length} ${pEntityToGather} records for ${pDestinationEntity} [${pDestinationIDEntity}].`);
				pEntityContainer[pEntityContainerHash] = pRecords;
				this.progressTracker.endProgressTracker(`${pEntityToGather}-Download-${pDestinationEntityName}-${pDestinationIDEntity}`);
				if (!pSilent)
				{
					this.progressTracker.logProgressTrackerStatus(`${pEntityToGather}-Download-${pDestinationEntityName}-${pDestinationIDEntity}`);
				}
				return fCallback(pError);
			});
	}

	generateRequestPath(pBaseGraphConnection, pEndpointGraphConnection)
	{
		// Walk backwards (right to left) and generate the request path for an entity -- based on the cardinality of the connection.
		let tmpGraphConnectionSet = [];

		let tmpCurrentGraphConnection = pEndpointGraphConnection;
		let tmpRightGraphConnection = false;

		while (tmpCurrentGraphConnection.EdgeAddress != pBaseGraphConnection.EdgeAddress)
		{
			let tmpGraphRequest = (
				{
					Entity: tmpCurrentGraphConnection.EntityName,
					Depth: tmpCurrentGraphConnection.Depth,
					DataSet: tmpCurrentGraphConnection.EdgeAddress
				});

			// Now to figure out how to filter these!  For the Endpoint, we just use any passed-in filters but nothing on the automagic ones.
			if (pEndpointGraphConnection.EdgeAddress === tmpCurrentGraphConnection.EdgeAddress)
			{
				tmpGraphRequest.FilterValueColumn = false;
				tmpGraphRequest.FilterSourceDataSet = false;
			}
			else if (tmpRightGraphConnection)
			{
				// Check if this is based on an outgoing or incoming join
				if (this._OutgoingEntityConnections[tmpRightGraphConnection.EntityName].hasOwnProperty(tmpGraphRequest.Entity))
				{
					tmpGraphRequest.FilterSourceDataSet = tmpRightGraphConnection.EdgeAddress;
					tmpGraphRequest.FilterValueColumn = this._OutgoingEntityConnections[tmpRightGraphConnection.EntityName][tmpGraphRequest.Entity];
				}
				else if (this._IncomingEntityConnections[tmpRightGraphConnection.EntityName].hasOwnProperty(tmpGraphRequest.Entity))
				{
					tmpGraphRequest.FilterSourceDataSet = tmpRightGraphConnection.EdgeAddress;
					tmpGraphRequest.FilterValueColumn = this._IncomingEntityConnections[tmpRightGraphConnection.EntityName][tmpGraphRequest.Entity];
				}
				else
				{
					throw new Error(`Error generating graph request path ... join not found in path edge.`);
				}
			}
			else
			{
				throw new Error(`Error generating graph request path ... previous graph connection not found on non endpoint/base graph edge.`);
			}

			tmpGraphConnectionSet.push(tmpGraphRequest);

			tmpRightGraphConnection = tmpCurrentGraphConnection;
			tmpCurrentGraphConnection = typeof (pBaseGraphConnection.AttemptedPaths[tmpCurrentGraphConnection.ParentEdgeAddress]) === 'object' ? pBaseGraphConnection.AttemptedPaths[tmpCurrentGraphConnection.ParentEdgeAddress] : pBaseGraphConnection;
		}

		// Now put in the final (base) request
		let tmpBaseGraphRequest = (
			{
				Entity: tmpCurrentGraphConnection.EntityName,
				Depth: tmpCurrentGraphConnection.Depth,
				DataSet: tmpCurrentGraphConnection.EdgeAddress
			});

		if (tmpRightGraphConnection)
		{
			// Check if this is based on an outgoing or incoming join
			if (this._OutgoingEntityConnections[tmpRightGraphConnection.EntityName].hasOwnProperty(tmpBaseGraphRequest.Entity))
			{
				tmpBaseGraphRequest.FilterSourceDataSet = tmpRightGraphConnection.EdgeAddress;
				tmpBaseGraphRequest.FilterValueColumn = this._OutgoingEntityConnections[tmpRightGraphConnection.EntityName][tmpBaseGraphRequest.Entity];
			}
			else if (this._IncomingEntityConnections[tmpRightGraphConnection.EntityName].hasOwnProperty(tmpBaseGraphRequest.Entity))
			{
				tmpBaseGraphRequest.FilterSourceDataSet = tmpRightGraphConnection.EdgeAddress;
				tmpBaseGraphRequest.FilterValueColumn = this._IncomingEntityConnections[tmpRightGraphConnection.EntityName][tmpBaseGraphRequest.Entity];
			}
			else
			{
				throw new Error(`Error generating base graph request path ... join not found in path edge.`);
			}
		}

		tmpGraphConnectionSet.push(tmpBaseGraphRequest);

		return tmpGraphConnectionSet;
	}

	/**
	 * Solve the entity graph connections between two entities, taking into account hinting.
	 * 
	 * Recursive.  Not fast.  Not slow.  Coded for readability as the first metric.  Results are cached.
	 * 
	 * Automatic traversal *ONLY* navigates the entity path for well-formed connections (IDEntity -> IDEntity);
	 * other traversals are possible by manual hinting.
	 * 
	 * @param {string} pStartEntityName - the entity to solve the graph path from
	 * @param {string} pDestinationEntity - the entity to solve the graph path to
	 * @param {Object} pEntityPathHints - any hinted paths to use
	 * @param {Object} pManualPaths - any manual paths to use
	 * @param {Object} pBaseGraphConnection - the "root" of the tree; used for metrics mostly
	 * @param {Object} pTraversalObject - a specialized traversal object for the breadth-first search.
	 * @param {number} pDepth - the current depth of the tree; used to bail out if we pass a threshold
	 * @returns {Object} a valid graph connection object
	 */
	solveGraphConnections(pStartEntityName, pDestinationEntity, pEntityPathHints, pBaseGraphConnection, pParentEntity, pWeight)
	{
		let tmpGraphConnection = {};

		// Hints are a set of strings to hint which path is preferential
		// For instance if the path was `Book->Rating->Author` or 
		// `Book->Publisher->Author` or `Book->BookAuthorJoin->Author` we could
		// hint that we want 'BookAuthorJoin' in the route.
		//
		// There are other more complex examples such as:
		// `Book<-BookAuthorJoin->Author->ReaderAuthorReview->Customer`
		// `Book->Cart->CartDetail->Transaction->Customer`
		// `Book->ReadingClub->ReaderBookReview->Customer`
		//
		// We could hint that we want 'BookAuthorJoin' and 'ReaderAuthorReview' 
		// in the route, and it would take the longer path.

		tmpGraphConnection.EntityName = pStartEntityName;
		tmpGraphConnection.EdgeTraversalEndpoints = `${pStartEntityName}-->${pDestinationEntity}`;

		this.log.info(`Starting to solve graph connections from ${pStartEntityName} to ${pDestinationEntity}.`);

		let tmpBaseGraphConnection = (typeof (pBaseGraphConnection) === 'undefined') ? tmpGraphConnection : pBaseGraphConnection;
		// The set of all graph connections we've tried (at *ALL* layers)
		if (!(`AttemptedPaths` in tmpBaseGraphConnection))
		{
			tmpBaseGraphConnection.AttemptedPaths = {};
			tmpBaseGraphConnection.PotentialSolutions = [];
			tmpBaseGraphConnection.OptimalSolutionPath = false;
		}

		// We are tracking addresses rather than creating many circular JSON objects.
		// Also this tracks them per destination, so we can reuse them later if there are farther out there chains.
		if (typeof (pBaseGraphConnection) === 'undefined')
		{
			tmpBaseGraphConnection.Base = true;
			tmpBaseGraphConnection.EdgeAddress = pStartEntityName;
			tmpBaseGraphConnection.ParentEdgeAddress = '';

			tmpBaseGraphConnection.AttemptedEntities = {};
			tmpBaseGraphConnection.AttemptedEntities[pStartEntityName] = true;

			tmpBaseGraphConnection.EntityPathHints = (typeof (pEntityPathHints) === 'undefined') ? [] : pEntityPathHints;
			// If we have default hints for this path, union them with the already passed-in hints
			if (this._DefaultHints.hasOwnProperty(tmpGraphConnection.EdgeTraversalEndpoints))
			{
				tmpBaseGraphConnection.EntityPathHints = Array.from(new Set(tmpBaseGraphConnection.EntityPathHints.concat(this._DefaultHints[tmpBaseGraphConnection.EdgeTraversalEndpoints])));
			}

			// Generate the cache key for this path
			tmpGraphConnection.CacheKey = `${pStartEntityName}-->${pDestinationEntity}[${this.fable.DataFormat.insecureStringHash(tmpGraphConnection.EntityPathHints.join(','))}]`;
		}
		else
		{
			tmpGraphConnection.Base = false;
			tmpGraphConnection.EdgeAddress = `${pParentEntity.EdgeAddress}-->${pStartEntityName}`;
			tmpGraphConnection.ParentEdgeAddress = pParentEntity.EdgeAddress;

			tmpGraphConnection.AttemptedEntities = JSON.parse(JSON.stringify(pParentEntity.AttemptedEntities));

			// Add ourself to the attempted entities set
			tmpGraphConnection.AttemptedEntities[pStartEntityName] = true;
		}

		if (tmpGraphConnection.Base)
		{
			// For the base, prevent the Javascript object from having a circular reference.
			tmpBaseGraphConnection.AttemptedPaths[tmpGraphConnection.EdgeAddress] = true;
		}
		else if (tmpBaseGraphConnection.AttemptedPaths.hasOwnProperty(tmpGraphConnection.EdgeAddress))
		{
			// We've already tried this path -- bail out.
			return tmpBaseGraphConnection;
		}
		else
		{
			// Add this to the attempted paths
			tmpBaseGraphConnection.AttemptedPaths[tmpGraphConnection.EdgeAddress] = tmpGraphConnection;
		}

		// The depth of this particular connection
		tmpGraphConnection.Depth = (typeof (pParentEntity) === 'undefined') ? 1 : pParentEntity.Depth + 1;
		tmpGraphConnection.Weight = (typeof (pWeight) === 'undefined') ? this.options.StartingWeight : pWeight;

		if (tmpGraphConnection.Depth > this.options.MaximumTraversalDepth)
		{
			this.log.warn(`Maximum traversal depth of ${this.options.MaximumTraversalDepth} reached attempting to get from ${tmpBaseGraphConnection.EntityName} to ${pDestinationEntity} when testing entity ${tmpGraphConnection.EntityName}.`);
			// This means there was no path solution in the maximum depth.
			return tmpBaseGraphConnection;
		}

		// For now manual paths are only used for the base entity.
		if (tmpGraphConnection.Base && (tmpGraphConnection.EdgeTraversalEndpoints in this._DefaultManualPaths))
		{
			// This is solved with a manual path -- use the manual path and move on.
			tmpBaseGraphConnection.FromManualPath = true;
			tmpBaseGraphConnection.PotentialSolutions.push(this._DefaultManualPaths[tmpBaseGraphConnection.EdgeTraversalEndpoints]);
			return tmpBaseGraphConnection;
		}
		// For now cache is only used for the base entity.
		else if (tmpGraphConnection.Base && (tmpGraphConnection.EdgeTraversalEndpoints in this._GraphSolutionMap))
		{
			// This was solved already -- use the cached version and move on.
			// We may want to have some kind of hashing on the "hinting" to make sure we don't cache the wrong route.
			// TODO: Must add hinting to the cache key.  Disabled for now (the cache is just never populated)
			tmpBaseGraphConnection.FromCache = true;
			tmpBaseGraphConnection.PotentialSolutions.push(this._GraphSolutionMap[tmpBaseGraphConnection.EdgeTraversalEndpoints]);
		}
		else
		{
			// Time to solve us some graphs.
			/*
			The output format for this is an array of solutions ... each solution 
			has a weight (Join increases weight half a step to favor joins, 
			nonjoins decrease a full step)
			[
				{ Weight:950, EdgeAddress:"Book-->Author", Path:[{Entity:"Author", Depth: 3}, {Entity:"BookAuthorJoin", FilterColumnSet:"IDAuthor", Depth: 2}, {Entity:"Book", FilterColumnSet:"IDBook", Depth: 1}]},
				{ Weight:900, EdgeAddress:"Book-->Author", Path:[{Entity:"Author", Depth: 3}, {Entity:"Rating", FilterColumnSet:"IDAuthor", Depth: 2}, {Entity:"Book", FilterColumnSet:"IDBook", Depth: 1}]}
			]

			The request library later takes that chain of requests (along with 
			request filters) and makes them biggest depth back

			All potential solutions have a rank... these will be kept around for 
			the lifecycle of the graph client object.

			1. Start by checking direct outgoing joins; these are highest priority.
				e.g. if the data model has Book and BookEdition, and BookEdition has IDBook -> Book
					and we are looking for all BookEdition records for a particular Book:
					* BookEdition is the start Entity
					* Book is the destination Entity
					* Because BookEdition has a direct outgoing join to Book via IDBook, it is the highest priority

			2. Secondly checking direct incoming joins -> their outgoing joins

			3. Lastly check outside -> in joins
				e.g. if the data model has Book, BookAuthorJoin and BookAuther
					and we are looking for all Book records for a particular IDAuthor
					* Book is the start Entity
					* No outgoing joins satisfy
					* BookAuthorJoin satisfies an incoming join
					* BookAuthorJoin has an outgoing join so will solve this properly
			*/
			// See if this is a potential solution
			if (tmpGraphConnection.EntityName === pDestinationEntity)
			{
				// This one might be THE ONE!  Add it as a potential solution...
				// First, compute the additional weight for this solution based on hints
				let tmpHintWeight = 0;
				for (let i = 0; i < tmpBaseGraphConnection.EntityPathHints.length; i++)
				{
					if (tmpGraphConnection.AttemptedEntities.hasOwnProperty(tmpBaseGraphConnection.EntityPathHints[i]))
					{
						tmpHintWeight = tmpHintWeight + this.options.HintWeight;
					}
				}
				let tmpPotentialSolution = (
					{
						Weight: tmpGraphConnection.Weight + tmpHintWeight,
						HintWeight: tmpHintWeight,
						EdgeAddress: tmpGraphConnection.EdgeAddress,
						RequestPath: this.generateRequestPath(tmpBaseGraphConnection, tmpGraphConnection, pDestinationEntity)
					});
				tmpBaseGraphConnection.PotentialSolutions.push(tmpPotentialSolution);
			}
			else
			{
				// 1. Start by checking direct outgoing joins
				if (this._OutgoingEntityConnections[pStartEntityName].hasOwnProperty(pDestinationEntity))
				{
					let tmpAttemptedConnectedEntity = pDestinationEntity;
					let tmpAttemptedEdgeAddress = `${tmpAttemptedConnectedEntity}-->${pDestinationEntity}`;
					// This prevents circles without eliminating intermediates for different paths later.
					if (!tmpBaseGraphConnection.AttemptedPaths.hasOwnProperty(tmpAttemptedEdgeAddress) && (tmpGraphConnection.EntityName != tmpAttemptedConnectedEntity))
					{
						let tmpAttemptWeight = tmpGraphConnection.Weight + this.options.TraversalHopWeight;
						// Outgoing Joins get a boost in weight
						tmpAttemptWeight = tmpAttemptWeight + this.options.OutgoingJoinWeight;
						if (tmpAttemptedConnectedEntity.indexOf('Join', tmpAttemptedConnectedEntity.length - 4) === 0)
						{
							tmpAttemptWeight = tmpAttemptWeight + this.options.JoinInTableNameWeight;
						}
						this.solveGraphConnections(tmpAttemptedConnectedEntity, pDestinationEntity, pEntityPathHints, tmpBaseGraphConnection, tmpGraphConnection, tmpAttemptWeight);
					}
				}

				// 2. Check direct incoming joins to their outgoing joins
				//    We *could* respect multi-joins here, but, meh for now... hinting can resolve any of the hard issues.
				//    This search is depth-first, using recursion
				let tmpIncomingJoinKeys = Object.keys(this._IncomingEntityConnections[tmpGraphConnection.EntityName]);
				for (let i = 0; i < tmpIncomingJoinKeys.length; i++)
				{
					let tmpAttemptedConnectedEntity = tmpIncomingJoinKeys[i];
					let tmpAttemptedEdgeAddress = `${tmpGraphConnection.EdgeAddress}-->${pDestinationEntity}`;
					// This prevents circles without eliminating intermediates for different paths later.
					if (!tmpBaseGraphConnection.AttemptedPaths.hasOwnProperty(tmpAttemptedEdgeAddress) && (tmpGraphConnection.EntityName != tmpAttemptedConnectedEntity))
					{
						let tmpAttemptWeight = tmpGraphConnection.Weight + this.options.TraversalHopWeight;
						if (tmpAttemptedConnectedEntity.indexOf('Join', tmpAttemptedConnectedEntity.length - 4) === 0)
						{
							tmpAttemptWeight = tmpAttemptWeight + this.options.JoinInTableNameWeight;
						}
						this.solveGraphConnections(tmpAttemptedConnectedEntity, pDestinationEntity, pEntityPathHints, tmpBaseGraphConnection, tmpGraphConnection, tmpAttemptWeight);
					}
				}

			}
		}

		// Now sort the graph requests by Weight and generate the optimal solution path
		if (tmpGraphConnection.Base && (tmpBaseGraphConnection.PotentialSolutions.length > 0))
		{
			tmpBaseGraphConnection.PotentialSolutions.sort((a, b) => (a.Weight < b.Weight) ? 1 : -1);
			if (tmpBaseGraphConnection.PotentialSolutions.length > 0)
			{
				this._GraphSolutionMap[tmpBaseGraphConnection.EdgeTraversalEndpoints] = tmpBaseGraphConnection.PotentialSolutions[0];
			}

			if (tmpBaseGraphConnection.PotentialSolutions.length > 0)
			{
				tmpBaseGraphConnection.OptimalSolutionPath = tmpBaseGraphConnection.PotentialSolutions[0];
			}
		}

		return tmpGraphConnection;
	}

	getFilterComparisonOperator(pFilterOperator)
	{
		let tmpOperator = '=';
		switch (pFilterOperator)
		{
			case '=': tmpOperator = 'EQ'; break;
			case '!=': tmpOperator = 'NE'; break;
			case '>': tmpOperator = 'GT'; break;
			case '>=': tmpOperator = 'GE'; break;
			case '<': tmpOperator = 'LT'; break;
			case '<=': tmpOperator = 'LE'; break;
			case 'LIKE': tmpOperator = 'LK'; break;
			case 'NOT LIKE': tmpOperator = 'NLK'; break;
			case 'IS NULL': tmpOperator = 'IN'; break;
			case 'IS NOT NULL': tmpOperator = 'NN'; break;
			case 'IN': tmpOperator = 'INN'; break;
			case '(': tmpOperator = 'FOP'; break;
			case ')': tmpOperator = 'FCP'; break;
			default: tmpOperator = pFilterOperator; break;
		}
		return tmpOperator;
	}

	/**
	 * 
	 * @param {Object} pFilterArray - The generated filter object
	 * 
	 * @returns {string} the meadow query string from this filter object
	 */
	convertFilterObjectToFilterString(pFilterArray)
	{
		let tmpFilterString = "";
		if (!Array.isArray(pFilterArray) || pFilterArray.length < 1)
		{
			return tmpFilterString;
		}

		for (let i = 0; i < pFilterArray.length; i++)
		{
			tmpFilterString += `${pFilterArray[i].MeadowFilterType}~${pFilterArray[i].Column}~${this.getFilterComparisonOperator(pFilterArray[i].Operator)}~${pFilterArray[i].Value}`;
		}

		return tmpFilterString;
	}

	compileFilter(pFilterObject)
	{
		// 0. Lint the Filter Object
		if (!this.lintFilterObject(pFilterObject))
		{
			return fCallback(new Error('Meadow Graph Client: The filter object is not valid.'), null, pFilterObject);
		}

		// 1. Parse the Filter Object
		let tmpCompiledGraphRequest = {};

		tmpCompiledGraphRequest.ParsedFilter = this.parseFilterObject(pFilterObject);

		tmpCompiledGraphRequest.RequestPaths = {};

		// 2. Get the paths for each required entity in the parsed filter object
		for (let i = 0; i < tmpCompiledGraphRequest.ParsedFilter.RequiredEntities.length; i++)
		{
			let tmpEntityName = tmpCompiledGraphRequest.ParsedFilter.RequiredEntities[i];
			if (tmpEntityName != pFilterObject.Entity)
			{
				tmpCompiledGraphRequest.RequestPaths[tmpEntityName] = this.solveGraphConnections(pFilterObject.Entity, tmpEntityName, pFilterObject.Hints);
			}
		}

		// 3. (not doing this yet -- it may not even be possible!!) Optimize the paths to only do one request per entity

		// 4. Build the chain of requests that have to happen -- order is unimportant other than doing the core requested entity last.
		/*
		"Request" objects have a particular format:
		{
			Entity: "Book",
			MeadowFilter: "FBV~IDAuthor~EQ~8675309"
		}
		*/
		tmpCompiledGraphRequest.Requests = [];
		for (let i = 0; i < tmpCompiledGraphRequest.ParsedFilter.RequiredEntities.length; i++)
		{
			let tmpEndpointEntityName = tmpCompiledGraphRequest.ParsedFilter.RequiredEntities[i];
			// Get the basal/endpoint requests
			if (tmpEndpointEntityName != tmpCompiledGraphRequest.ParsedFilter.Entity)
			{
				let tmpRequestObject = ({
						// The Entity to get
						Entity:tmpEndpointEntityName,
						// The filter to apply to the Entity
						MeadowFilter:this.convertFilterObjectToFilterString(tmpCompiledGraphRequest.ParsedFilter.FilterExpressionSet[tmpEndpointEntityName]),
						// The chain of requests to make with the graph
						GraphRequestChain:[]
					});

				// Each of these in the GraphRequestChain requests will use the previous request data to pull the filter for the next.
				// Join cardinality is key.
				let tmpGraphRequestSolution = tmpCompiledGraphRequest.RequestPaths[tmpEndpointEntityName].OptimalSolutionPath;
				for (let j = 0; j < tmpGraphRequestSolution.RequestPath.length; j++)
				{
					if ((tmpGraphRequestSolution.RequestPath[j].Entity != tmpCompiledGraphRequest.ParsedFilter.Entity) && (tmpGraphRequestSolution.RequestPath[j].Entity != tmpEndpointEntityName))
					{
						tmpRequestObject.GraphRequestChain.push(tmpGraphRequestSolution.RequestPath[j].Entity);
					}
				}

				tmpCompiledGraphRequest.Requests.push(tmpRequestObject);
			}
		}

		return tmpCompiledGraphRequest;
	}

	/**
	 * Retrieves a bundle of graph data from the server.
	 *
	 * @param {string} pEntityName - The name of the entity to retrieve.
	 * @param {object} pFilterObject - The filter object to apply to the query.
	 * @param {function} fCallback - The callback function with the signature (pError, pData, pFilterObject) to execute after the data is retrieved
	 */
	get(pFilterObject, fCallback)
	{
		let tmpCompiledFilter = this.compileFilter(pFilterObject);

		// Now start to get the records outlined by the compiled filter.
		let tmpAnticipate = this.fable.newAnticipate();

		for (let i = 0; i < tmpCompiledFilter.Requests.length; i++)
		{
			let tmpRequest = tmpCompiledFilter.Requests[i];

			tmpAnticipate.anticipate((fStageComplete) =>
			{
				this.log.info(`Performing request to Entity [${tmpRequest.Entity}] filter [${tmpRequest.MeadowFilter}]`);
				tmpRequest.Result = [];

				// Now put the downstream requests on the anticipate chain... this is breadth first, rather than depth
				for (let j = 0; j < tmpRequest.GraphRequestChain.length; j++)
				{
					let tmpDownstreamRequest = (
						{
							Entity: tmpRequest.GraphRequestChain[j],
							// This will either be
							// --> an in list of internal records from the previous request in the chain,
							// or,
							// --> an in list of external record IDs based on the join cardinality.
							MeadowFilter: `GeneratedDownstreamFilter`
						});
					tmpAnticipate.anticipate((fDownstreamRequestStageComplete) =>
					{
						this.log.info(`Performing downstream request to Entity [${tmpDownstreamRequest.Entity}] filter [${tmpDownstreamRequest.MeadowFilter}]`);
						return fDownstreamRequestStageComplete();
					});
				}

				return fStageComplete();
			});

		}

		tmpAnticipate.wait(
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`Meadow Graph Client: There was an error getting supporting records for ${tmpCompiledFilter.Entity}.`);
				}
				// Now do the actual request
				this.log.info(`Performing request for Entity [${tmpCompiledFilter.ParsedFilter.Entity}] filter []`);

				return fCallback(pError, tmpCompiledFilter);
			});
	}
};

module.exports = MeadowGraphClient;