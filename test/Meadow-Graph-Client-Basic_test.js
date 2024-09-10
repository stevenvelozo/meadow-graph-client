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
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient');
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

								Expect(_MeadowGraphClient._KnownEntities).to.contain.keys('Book');
								Expect(_MeadowGraphClient._KnownEntities).to.contain.keys('Author');
								Expect(_MeadowGraphClient._KnownEntities).to.contain.keys('BookAuthorJoin');

								Expect(_MeadowGraphClient._IncomingEntityConnections.Book).to.contain.keys('BookAuthorJoin');
								Expect(_MeadowGraphClient._IncomingEntityConnections.Author).to.contain.keys('BookAuthorJoin');

								Expect(_MeadowGraphClient._OutgoingEntityConnections.BookAuthorJoin).to.contain.keys('Book');

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

								Expect(_MeadowGraphClient._KnownEntities).to.contain.keys('Book');
								Expect(_MeadowGraphClient._KnownEntities).to.contain.keys('Author');
								Expect(_MeadowGraphClient._KnownEntities).to.contain.keys('BookAuthorJoin');

								Expect(_MeadowGraphClient._IncomingEntityConnections.Book).to.contain.keys('BookAuthorJoin');
								Expect(_MeadowGraphClient._IncomingEntityConnections.Author).to.contain.keys('BookAuthorJoin');

								Expect(_MeadowGraphClient._OutgoingEntityConnections.BookAuthorJoin).to.contain.keys('Book');

								return fDone();
							}
						);
					test(
							'Acquire the path from Book to Author using Implicit Filters',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
								_MeadowGraphClient.loadDataModel(modelBookStore);

								// Simple filter, getting all books where Author.IDAuthor = 107
								// Traverses a join.
								let tmpFilterObject = _MeadowGraphClient.parseFilterObject({Entity: 'Book', Filter:{"Author.IDAuthor":107, "BookPrice.Discountable":true}});

								Expect(tmpFilterObject).to.be.an('object');
								// There should be an author filter, value 107
								//Expect(tmpFilterObject.FilterExpressionSet.Author).to.be.an('Array');
								//Expect(tmpFilterObject.FilterExpressionSet.Author[0].Value).to.equal(107);

								let tmpGraphTraversalObject = _MeadowGraphClient.solveGraphConnections(tmpFilterObject.Entity, 'Author');

								Expect(tmpGraphTraversalObject).to.be.an('object');

								return fDone();
							}
						);
				}
			);
	}
);