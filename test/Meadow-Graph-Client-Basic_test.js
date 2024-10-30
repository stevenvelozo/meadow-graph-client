/*
	Unit tests for MeadowGraphClient
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libFable = require('fable');
const libMeadowGraphClient = require(`../source/Meadow-Graph-Client.js`);

//TODO: This warmup cuts 13ms off of the first test.  Profile and see if it's worth 10ms to change.
//const warmupFable = new libFable();

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
								Expect(tmpFilterObject.FilterExpressionSet.Author).to.be.an('Array');
								Expect(tmpFilterObject.FilterExpressionSet.Author[0].Value).to.equal(107);

								let tmpGraphTraversalObject = _MeadowGraphClient.solveGraphConnections(tmpFilterObject.Entity, 'Author');

								Expect(tmpGraphTraversalObject).to.be.an('object');
								Expect(tmpGraphTraversalObject.PotentialSolutions).to.be.an('Array');
								Expect(tmpGraphTraversalObject.PotentialSolutions).to.have.lengthOf(1);
								Expect(tmpGraphTraversalObject.PotentialSolutions[0].EdgeAddress).to.equal('Book-->BookAuthorJoin-->Author');

								return fDone();
							}
						);

					test(
							'Compile a Graph Filter Object ready for Requests from Book->Author',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
								_MeadowGraphClient.loadDataModel(modelBookStore);

								// Simple filter, getting all books where Author.IDAuthor = 107
								// Traverses a join.
								let tmpFilterObject = _MeadowGraphClient.compileFilter({Entity: 'Book', Filter:{"Author.IDAuthor":107, "BookPrice.Discountable":true}});

								Expect(tmpFilterObject.Requests).to.be.an('Array');

								Expect(tmpFilterObject.Requests[0].Entity).to.equal('Author');

								Expect(tmpFilterObject.RequestPaths['Author'].OptimalSolutionPath.EdgeAddress).to.equal('Book-->BookAuthorJoin-->Author')

								return fDone();
							}
						);

					test(
							'Compile a Graph Filter Object and GET from Book->Author',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
								_MeadowGraphClient.loadDataModel(modelBookStore);

								// Simple filter, getting all books where Author.IDAuthor = 107
								// Traverses a join.
								_MeadowGraphClient.get({Entity: 'Book', Filter:{"Author.IDAuthor":107, "BookPrice.Discountable":true}},
									(pError, pCompiledGraphRequest) =>
									{
										Expect(pCompiledGraphRequest.Requests).to.be.an('Array');

										Expect(pCompiledGraphRequest.Requests[0].Entity).to.equal('Author');

										Expect(pCompiledGraphRequest.RequestPaths['Author'].OptimalSolutionPath.EdgeAddress).to.equal('Book-->BookAuthorJoin-->Author')

										return fDone();
									}
								);
							}
						);
				}
			);
	}
);