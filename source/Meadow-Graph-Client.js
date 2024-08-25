const libFableServiceProviderBase = require('fable-serviceproviderbase');

/**
 * Class representing a Meadow Graph Client.
 * @extends libFableServiceProviderBase
 */
class MeadowGraphClient extends libFableServiceProviderBase
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);
        this.serviceType = 'MeadowGraphClient';

		// Map of joins (Entity->Other Entities)
		this._JoinMap = {};
		// Map of incoming connections for Entities (Entity->Incoming Entities)
		this._JoinReverseMap = {};

		// Known tables (loaded into the data model)
		this._KnownTables = {};

		if (this.options.DataModel)
		{
			this.loadDataModel(this.options.DataModel);
		}
	}

	/**
	 * Adds a join to the data model graph.
	 *
	 * @param {string} pColumn - The column to join on.
	 * @param {string} pJoinEntity - The entity to join.
	 * @param {string} pTableName - The table name to join.
	 */
	addJoin(pColumn, pJoinEntity, pTableName)
	{
		if (!this._JoinMap.hasOwnProperty(pJoinEntity))
		{
			this._JoinMap[pJoinEntity] = {};
		}

		if (!this._JoinMap[pJoinEntity].hasOwnProperty(pTableName))
		{
			this._JoinMap[pJoinEntity][pTableName] = pColumn;
		}
		else
		{
			// There are times when an entity refers to itself.  And.  Times when an entity is joined multiple times.
			// TODO: We should refine this to deal with that in a sane way.
			this.log.warn(`Meadow Graph Client: There is already a join for ${pJoinEntity} from ${pTableName}; connection will be ignored for ${pColumn}.`);
		}
	}

	/**
	 * Adds a reverse join to the data model graph.
	 *
	 * @param {string} pColumn - The column to join on.
	 * @param {string} pConnectedEntity - The connected entity to join.
	 * @param {string} pIncomingEntity - The incoming entity to join.
	 */
	addJoinReverse(pColumn, pConnectedEntity, pIncomingEntity)
	{
		if (!this._JoinReverseMap.hasOwnProperty(pConnectedEntity))
		{
			this._JoinReverseMap[pConnectedEntity] = {};
		}
		if (!this._JoinReverseMap[pConnectedEntity].hasOwnProperty(pIncomingEntity))
		{
			this._JoinReverseMap[pConnectedEntity][pIncomingEntity] = pColumn;
		}
		else
		{
			// There are times when an entity refers to itself.  And.  Times when an entity is joined multiple times.
			// We should refine this to deal with that in a sane way.
			this.log.warn(`Meadow Graph Client: There is already a reverse join for ${pConnectedEntity} from ${pTableName}; connection will be ignored for ${pColumn}.`);
		}
	}

	/**
	 * Adds a table to the data model.
	 * 
	 * @param {object} pTable - The table object to be added.
	 * @returns {boolean} - Returns true if the table is successfully added, false otherwise.
	 */
	addTableToDataModel(pTable)
	{
		if (!pTable.hasOwnProperty('Columns'))
		{
			this.log.error(`Meadow Graph Client: Could not add table to the data model because it does not have a Columns property.`);
			return false;
		}
		if (!Array.isArray(pTable.Columns))
		{
			this.log.error(`Meadow Graph Client: Could not add table to the data model because the Columns property is not an array.`);
			return false;
		}
		if (this._KnownTables.hasOwnProperty(pTable.TableName))
		{
			this.log.warn(`Meadow Graph Client: The table ${pTable.TableName} is already known; it won't be added to the graph.`);
			return false;
		}
		else
		{
			this._KnownTables[pTable.TableName] = pTable;
		}

		for (let i = 0; i < pTable.Columns.length; i++)
		{
			// TODO: Potentially create a secondary set of graph connections across these audit joins, although they are really star/spokes as opposed to directed graphs.
			if (pTable.Columns[i].Join &&
				pTable.Columns[i].Column != 'IDCustomer' &&
				pTable.Columns[i].Column != 'CreatingIDUser' &&
				pTable.Columns[i].Column != 'UpdatingIDUser' &&
				pTable.Columns[i].Column != 'DeletingIDUser')
			{
				// TODO: This is a little smelly.
				let tmpJoinedEntity = pTable.Columns[i].Join.startsWith('ID') ? pTable.Columns[i].Join.substring(2) : pTable.Columns[i].Join;
				this.addJoin(pTable.Columns[i].Column, tmpJoinedEntity, pTable.TableName);
				this.addJoinReverse(pTable.Columns[i].Column, pTable.TableName, tmpJoinedEntity);
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
		let tmpDataModel = (typeof(pDataModel) == 'object') ? pDataModel : false;
		if (!tmpDataModel)
		{
			this.log.error(`Meadow Graph Client: Could not load a DataModel because it was not passed in or set in the options.`);
			return false;
		}
		if ((!tmpDataModel.hasOwnProperty('Tables')) || (typeof(tmpDataModel) != 'object'))
		{
			this.log.error(`Meadow Graph Client: The DataModel object does not have a Tables property or it is not an object, so cannot be loaded.`);
			return false;
		}
		// Enumerate each data set in the data model and create a join lookup if it isn't an internal audit column
		let tmpTables = Object.keys(tmpDataModel.Tables);
		for (let i = 0; i < tmpTables.length; i++)
		{
			let tmpTable = tmpDataModel.Tables[tmpTables[i]];
			this.addTableToDataModel(tmpTable);
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
		if (typeof(pFilterObject) !== 'object')
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
	 * Parses the filter object and returns valid filters.
	 *
	 * @param {Object} pFilterObject - The filter object to parse.
	 * @returns {Object} - A linted and valid filter object.
	 */
	parseFilterObject(pFilterObject)
	{
		let tmpFilterObject = pFilterObject;

		// 1. Enumerate the filters
		let tmpFilters = Object.keys(tmpFilterObject.Filter);
		for (let i = 0; i < tmpFilters.length; i++)
		{
			let tmpFilterHash = tmpFilters[i];
			let tmpFilter = tmpFilterObject.Filter[tmpFilterHash];

			let tmpCompiledFilter = {};
			tmpCompiledFilter.Hash = tmpFilterHash;
			if (tmpFilter.hasOwnProperty('Entity'))
			{
				tmpCompiledFilter.Entity = tmpFilter.Entity;
			}
			else
			{
				// See if the column is in the core entity
			}
		}

		return tmpFilterObject;
	}

	/**
	 * Retrieves a bundle of graph data from the server.
	 *
	 * @param {string} pEntityName - The name of the entity to retrieve.
	 * @param {object} pFilterObject - The filter object to apply to the query.
	 * @param {function} fCallback - The callback function with the signature (pError, pData, pFilterObject) to execute after the data is retrieved
	 */
	get(pEntityName, pFilterObject, fCallback)
	{
		if (!this.lintFilterObject(pFilterObject))
		{
			return fCallback(new Error('Meadow Graph Client: The filter object is not valid.'), null, pFilterObject);
		}

		let tmpFilterObject = this.parseFilterObject(pFilterObject);
		let tmpDataOutputObject = {};

		// Now get the records in the parsed filter object
		let tmpAnticipate = this.fable.newAnticipate();

		tmpAnticipate.anticipate((fStageComplete) =>
		{
			this.getRecords(pEntityName, tmpFilterObject, (pError, pData) =>
			{
				if (pError)
				{
					return fStageComplete(pError);
				}
				return fStageComplete(null, pData);
			});
		});

		tmpAnticipate.wait(
			(pError) =>
			{
				if (pError)
				{
				}
				return fCallback(pError, tmpDataOutputObject, tmpFilterObject);
			});
	}
};

module.exports = MeadowGraphClient;