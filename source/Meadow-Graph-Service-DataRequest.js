const libFableServiceProviderBase = require('fable-serviceproviderbase');

/**
 * Class representing a Meadow Graph Client's Request Library.
 *
 * This is a stub/base class that provides the HTTP request interface.
 * Override doGetJSON, doPostJSON, doPutJSON with actual HTTP implementations.
 *
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
	 * @param {Function} fCallback - The callback function to continue.
	 */
	onBeforeGetJSON(pURL, fCallback)
	{
		return fCallback();
	}

	/**
	 * Controller function for a GET request to retrieve JSON data from the specified URL.
	 * Calls onBeforeGetJSON, then doGetJSON, then onAfterGetJSON.
	 *
	 * @param {string} pURL - The URL to retrieve JSON data from.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	getJSON(pURL, fCallback)
	{
		this.onBeforeGetJSON(pURL,
			() =>
			{
				this.doGetJSON(pURL,
					(pError, pResponse) =>
					{
						this.onAfterGetJSON(pURL, pError, pResponse, fCallback);
					});
			});
	}

	/**
	 * Performs the actual GET request to retrieve JSON data.
	 * Override this method with a real HTTP implementation.
	 *
	 * @param {string} pURL - The URL to send the GET request to.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	doGetJSON(pURL, fCallback)
	{
		return fCallback(null, null);
	}

	/**
	 * Overloadable function called after making a GET request.
	 *
	 * @param {string} pURL - The URL of the request.
	 * @param {Error} pError - Any error that occurred.
	 * @param {any} pResponse - The response data.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	onAfterGetJSON(pURL, pError, pResponse, fCallback)
	{
		return fCallback(pError, pResponse);
	}

	/**
	 * Overloadable function called before making a POST request.
	 *
	 * @param {string} pURL - The URL of the endpoint.
	 * @param {object} pRequestPostObject - The data to post.
	 * @param {Function} fCallback - The callback function to continue.
	 */
	onBeforePostJSON(pURL, pRequestPostObject, fCallback)
	{
		return fCallback();
	}

	/**
	 * Controller function for a POST request.
	 *
	 * @param {string} pURL - The URL to post to.
	 * @param {object} pRequestPostObject - The data to post.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	postJSON(pURL, pRequestPostObject, fCallback)
	{
		this.onBeforePostJSON(pURL, pRequestPostObject,
			() =>
			{
				this.doPostJSON(pURL, pRequestPostObject,
					(pError, pResponse) =>
					{
						this.onAfterPostJSON(pURL, pRequestPostObject, pError, pResponse, fCallback);
					});
			});
	}

	/**
	 * Performs the actual POST request.
	 * Override this method with a real HTTP implementation.
	 *
	 * @param {string} pURL - The URL to post to.
	 * @param {object} pRequestPostObject - The data to post.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	doPostJSON(pURL, pRequestPostObject, fCallback)
	{
		return fCallback(null, null);
	}

	/**
	 * Overloadable function called after making a POST request.
	 *
	 * @param {string} pURL - The URL of the request.
	 * @param {object} pRequestPostObject - The data that was posted.
	 * @param {Error} pError - Any error that occurred.
	 * @param {any} pResponse - The response data.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	onAfterPostJSON(pURL, pRequestPostObject, pError, pResponse, fCallback)
	{
		return fCallback(pError, pResponse);
	}

	/**
	 * Overloadable function called before making a PUT request.
	 *
	 * @param {string} pURL - The URL of the endpoint.
	 * @param {object} pRequestPutObject - The data to put.
	 * @param {Function} fCallback - The callback function to continue.
	 */
	onBeforePutJSON(pURL, pRequestPutObject, fCallback)
	{
		return fCallback();
	}

	/**
	 * Controller function for a PUT request.
	 *
	 * @param {string} pURL - The URL to put to.
	 * @param {object} pRequestPutObject - The data to put.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	putJSON(pURL, pRequestPutObject, fCallback)
	{
		this.onBeforePutJSON(pURL, pRequestPutObject,
			() =>
			{
				this.doPutJSON(pURL, pRequestPutObject,
					(pError, pResponse) =>
					{
						this.onAfterPutJSON(pURL, pRequestPutObject, pError, pResponse, fCallback);
					});
			});
	}

	/**
	 * Performs the actual PUT request.
	 * Override this method with a real HTTP implementation.
	 *
	 * @param {string} pURL - The URL to put to.
	 * @param {object} pRequestPutObject - The data to put.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	doPutJSON(pURL, pRequestPutObject, fCallback)
	{
		return fCallback(null, null);
	}

	/**
	 * Overloadable function called after making a PUT request.
	 *
	 * @param {string} pURL - The URL of the request.
	 * @param {object} pRequestPutObject - The data that was put.
	 * @param {Error} pError - Any error that occurred.
	 * @param {any} pResponse - The response data.
	 * @param {function} fCallback - The callback function (pError, pData).
	 */
	onAfterPutJSON(pURL, pRequestPutObject, pError, pResponse, fCallback)
	{
		return fCallback(pError, pResponse);
	}
}

module.exports = MeadowGraphDataRequest;
module.exports.default_configuration = {};
