const libFableServiceProviderBase = require('fable-serviceproviderbase');

/**
 * Class representing a Meadow Graph Client's Request Library.
 * @extends libFableServiceProviderBase
 */
class MeadowGraphDataRequest extends libFableServiceProviderBase
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);
        this.serviceType = 'MeadowGraphClientDataRequest';
	}

	/**
	 * Overloadable function called before making a GET request to a JSON endpoint.
	 *
	 * @param {string} pURL - The URL of the JSON endpoint.
	 * @param {Function} fCallback - The callback function to be executed before the request.
	 * @returns {any} - The result of the callback function.
	 */
	onBeforeGetJSON(pURL, fCallback)
	{
		return fCallback();
	}

	/**
	 * Controller function for a GET request to retrieve JSON data from the specified URL.
	 * 
	 * @param {string} pURL - The URL to retrieve JSON data from.
	 * @param {function} fCallback - The callback function to be executed after retrieving the JSON data.
	 */
	getJSON(pURL, fCallback)
	{
		// Execute the onBeforeGetJSON method
		this.onBeforeGetJSON(pURL, fCallback); 
		// Actually GET the JSON, then, execute the onAfterGetJSON method
		// Where the expected prototype for getJSON returns fCallback(pError, pBody);
		// The base fable getJSON returns fCallback(pError, pRequest, pBody) --> this is meant to be an abstraction for the low-level library.
		return this.doGetJSON(pURL, this.onAfterGetJSON.bind(this));
	}

	/**
	 * Performs a GET request to retrieve JSON data from the specified URL.
	 *
	 * @param {string} pURL - The URL to send the GET request to.
	 * @param {function} fCallback - The callback function to handle the response.
	 * @returns {any} - The result of the GET request.
	 */
	doGetJSON(pURL, fCallback)
	{
		return fCallback();
	}

	onAfterGetJSON(pURL, pError, pResponse, fCallback)
	{
		return fCallback(pError, pResponse);
	}

	onBeforePostJSON(pURL, pRequestPostObject, fCallback)
	{
		return this.postJSON(pURL, pRequestPostObject, fCallback);
	}

	postJSON(pURL, pRequestPostObject, fCallback)
	{
		this.onBeforePostJSON(pURL, pRequestPostObject, fCallback);

		// actually POST the JSON

		return this.onAfterPostJSON(pURL, pRequestPostObject, fCallback);
	}

	onAfterPostJSON(pURL, pRequestPostObject, fCallback)
	{
		return fCallback();
	}

	onBeforePutJSON(pURL, pRequestPutObject, fCallback)
	{

	}

	onBeforePutJSON(pURL, pRequestPutObject, fCallback)
	{
		return this.putJSON(pURL, pRequestPutObject, fCallback);
	}
	putJSON(pURL, pRequestPutObject, fCallback)
	{

	}

	onAfterPutJSON(pURL, pRequestPutObject, fCallback)
	{

	}
}

module.exports = MeadowGraphDataRequest;
module.exports.default_configuration = {};
