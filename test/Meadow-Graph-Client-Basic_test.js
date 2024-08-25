/*
	Unit tests for MeadowGraphClient
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libFable = require('fable');
const libMeadowGraphClient = require(`../source/Meadow-Graph-Client.js`);

const modelBookStore = require(`./model/Retold-SampleData-Bookstore.json`);

suite
(
	'MeadowGraphClient Simple Exercise Suite',
	() =>
	{
		setup(() => { });

		suite
			(
				'Basic Tests',
				() =>
				{
					test(
							'Object Instantiation',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
								Expect(_MeadowGraphClient).to.be.an('object');
								return fDone();
							}
						);
					test(
							'Implicit Model',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});
								Expect(_MeadowGraphClient).to.be.an('object');

								Expect(_MeadowGraphClient._KnownTables).to.contain.keys('Book');
								Expect(_MeadowGraphClient._KnownTables).to.contain.keys('Author');
								Expect(_MeadowGraphClient._KnownTables).to.contain.keys('BookAuthorJoin');

								Expect(_MeadowGraphClient._JoinMap.Book).to.contain.keys('BookAuthorJoin');
								Expect(_MeadowGraphClient._JoinMap.Author).to.contain.keys('BookAuthorJoin');

								Expect(_MeadowGraphClient._JoinReverseMap.BookAuthorJoin).to.contain.keys('Book');

								return fDone();
							}
						);
					test(
							'Load a Model',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
								_MeadowGraphClient.loadDataModel(modelBookStore);
								Expect(_MeadowGraphClient).to.be.an('object');
								return fDone();
							}
						);
				}
			);
	}
);