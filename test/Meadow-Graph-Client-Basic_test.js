/*
	Unit tests for MeadowGraphClient
*/

const Chai = require('chai');
const Expect = Chai.expect;

const libFable = require('fable');
const libMeadowGraphClient = require(`../source/Meadow-Graph-Client.js`);
const libMeadowGraphDataRequest = require(`../source/Meadow-Graph-Service-DataRequest.js`);

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

		suite
			(
				'Data Model Management',
				() =>
				{
					test(
							'addEntityToDataModel rejects entities without Columns',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								let tmpResult = _MeadowGraphClient.addEntityToDataModel({TableName: 'NoColumns'});
								Expect(tmpResult).to.equal(false);

								return fDone();
							}
						);

					test(
							'addEntityToDataModel rejects entities with non-array Columns',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								let tmpResult = _MeadowGraphClient.addEntityToDataModel({TableName: 'BadColumns', Columns: 'not-an-array'});
								Expect(tmpResult).to.equal(false);

								return fDone();
							}
						);

					test(
							'addEntityToDataModel rejects duplicate entities',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								let tmpResult1 = _MeadowGraphClient.addEntityToDataModel({TableName: 'TestEntity', Columns: [{Column: 'IDTestEntity', DataType: 'ID'}]});
								Expect(tmpResult1).to.equal(true);

								let tmpResult2 = _MeadowGraphClient.addEntityToDataModel({TableName: 'TestEntity', Columns: [{Column: 'IDTestEntity', DataType: 'ID'}]});
								Expect(tmpResult2).to.equal(false);

								return fDone();
							}
						);

					test(
							'loadDataModel rejects non-object',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								let tmpResult = _MeadowGraphClient.loadDataModel('not-an-object');
								Expect(tmpResult).to.equal(false);

								return fDone();
							}
						);

					test(
							'loadDataModel rejects object without Tables property',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								let tmpResult = _MeadowGraphClient.loadDataModel({NoTables: true});
								Expect(tmpResult).to.equal(false);

								return fDone();
							}
						);

					test(
							'cleanMissingEntityConnections removes orphaned connections',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
								_MeadowGraphClient.loadDataModel(modelBookStore);

								// Manually add a connection to a nonexistent entity
								_MeadowGraphClient._OutgoingEntityConnections['Book']['FakeEntity'] = 'IDFakeEntity';
								_MeadowGraphClient._OutgoingEntityConnectionLists['Book'].push('FakeEntity');

								Expect(_MeadowGraphClient._OutgoingEntityConnections['Book']).to.have.property('FakeEntity');

								_MeadowGraphClient.cleanMissingEntityConnections();

								Expect(_MeadowGraphClient._OutgoingEntityConnections['Book']).to.not.have.property('FakeEntity');
								Expect(_MeadowGraphClient._OutgoingEntityConnectionLists['Book']).to.not.include('FakeEntity');

								return fDone();
							}
						);

					test(
							'Audit columns (CreatingIDUser, UpdatingIDUser, DeletingIDUser, IDCustomer) are ignored',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});
								_MeadowGraphClient.loadDataModel(modelBookStore);

								// These audit columns should not create connections
								Expect(_MeadowGraphClient._OutgoingEntityConnections.Book).to.not.have.property('User');
								Expect(_MeadowGraphClient._OutgoingEntityConnections.Book).to.not.have.property('Customer');

								return fDone();
							}
						);
				}
			);

		suite
			(
				'Filter Expression Building',
				() =>
				{
					test(
							'buildFilterExpression handles dot-notation entity references',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpExpression = _MeadowGraphClient.buildFilterExpression('Book', 'Author.IDAuthor', 107);

								Expect(tmpExpression).to.be.an('object');
								Expect(tmpExpression.Entity).to.equal('Author');
								Expect(tmpExpression.Column).to.equal('IDAuthor');
								Expect(tmpExpression.Value).to.equal(107);
								Expect(tmpExpression.Operator).to.equal('=');
								Expect(tmpExpression.Connector).to.equal('And');
								Expect(tmpExpression.MeadowFilterType).to.equal('FBV');

								return fDone();
							}
						);

					test(
							'buildFilterExpression handles simple column names in the pivotal entity',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpExpression = _MeadowGraphClient.buildFilterExpression('Book', 'Title', 'Test%');

								Expect(tmpExpression).to.be.an('object');
								Expect(tmpExpression.Entity).to.equal('Book');
								Expect(tmpExpression.Column).to.equal('Title');
								Expect(tmpExpression.Value).to.equal('Test%');
								Expect(tmpExpression.Operator).to.equal('LIKE');
								Expect(tmpExpression.MeadowFilterType).to.equal('FBV');

								return fDone();
							}
						);

					test(
							'buildFilterExpression returns false for unknown entity',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpExpression = _MeadowGraphClient.buildFilterExpression('Book', 'NonExistent.SomeColumn', 'value');

								Expect(tmpExpression).to.equal(false);

								return fDone();
							}
						);

					test(
							'buildFilterExpression returns false for unknown column',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpExpression = _MeadowGraphClient.buildFilterExpression('Book', 'FakeColumn', 'value');

								Expect(tmpExpression).to.equal(false);

								return fDone();
							}
						);

					test(
							'getDefaultFilterExpressionOperator returns LIKE for String and Text',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								Expect(_MeadowGraphClient.getDefaultFilterExpressionOperator('String')).to.equal('LIKE');
								Expect(_MeadowGraphClient.getDefaultFilterExpressionOperator('Text')).to.equal('LIKE');
								Expect(_MeadowGraphClient.getDefaultFilterExpressionOperator('Numeric')).to.equal('=');
								Expect(_MeadowGraphClient.getDefaultFilterExpressionOperator('ID')).to.equal('=');
								Expect(_MeadowGraphClient.getDefaultFilterExpressionOperator('Boolean')).to.equal('=');

								return fDone();
							}
						);

					test(
							'getMeadowFilterType returns correct filter types',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								Expect(_MeadowGraphClient.getMeadowFilterType('AND', '(')).to.equal('FOP');
								Expect(_MeadowGraphClient.getMeadowFilterType('AND', ')')).to.equal('FCP');
								Expect(_MeadowGraphClient.getMeadowFilterType('OR', '=')).to.equal('FBVOR');
								Expect(_MeadowGraphClient.getMeadowFilterType('AND', '=')).to.equal('FBV');

								return fDone();
							}
						);
				}
			);

		suite
			(
				'Filter Object Parsing',
				() =>
				{
					test(
							'parseFilterObject creates entity groups from dot-notation filters',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpParsed = _MeadowGraphClient.parseFilterObject({
									Entity: 'Book',
									Filter: {
										'Author.IDAuthor': 42,
										'Title': 'Test%'
									}
								});

								Expect(tmpParsed.Entity).to.equal('Book');
								Expect(tmpParsed.FilterExpressionSet).to.have.property('Book');
								Expect(tmpParsed.FilterExpressionSet).to.have.property('Author');
								Expect(tmpParsed.RequiredEntities).to.include('Book');
								Expect(tmpParsed.RequiredEntities).to.include('Author');

								// Author filter
								Expect(tmpParsed.FilterExpressionSet.Author).to.have.lengthOf(1);
								Expect(tmpParsed.FilterExpressionSet.Author[0].Column).to.equal('IDAuthor');
								Expect(tmpParsed.FilterExpressionSet.Author[0].Value).to.equal(42);

								// Book filter (Title is a string column)
								Expect(tmpParsed.FilterExpressionSet.Book).to.have.lengthOf(1);
								Expect(tmpParsed.FilterExpressionSet.Book[0].Column).to.equal('Title');
								Expect(tmpParsed.FilterExpressionSet.Book[0].Operator).to.equal('LIKE');

								return fDone();
							}
						);

					test(
							'parseFilterObject handles empty filter',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpParsed = _MeadowGraphClient.parseFilterObject({
									Entity: 'Book',
									Filter: {}
								});

								Expect(tmpParsed.Entity).to.equal('Book');
								Expect(tmpParsed.FilterExpressionSet.Book).to.be.an('Array');
								Expect(tmpParsed.FilterExpressionSet.Book).to.have.lengthOf(0);

								return fDone();
							}
						);

					test(
							'lintFilterObject validates required properties',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								// Not an object
								Expect(_MeadowGraphClient.lintFilterObject('bad')).to.equal(false);

								// No Entity
								Expect(_MeadowGraphClient.lintFilterObject({})).to.equal(false);

								// Valid minimal
								let tmpFilter = {Entity: 'Book'};
								Expect(_MeadowGraphClient.lintFilterObject(tmpFilter)).to.equal(true);
								Expect(tmpFilter.Filter).to.be.an('object');
								Expect(tmpFilter.Options).to.be.an('object');
								Expect(tmpFilter.Options.RecordLimit).to.equal(10000);
								Expect(tmpFilter.Options.PageSize).to.equal(100);

								return fDone();
							}
						);
				}
			);

		suite
			(
				'Graph Solving',
				() =>
				{
					test(
							'solveGraphConnections finds direct outgoing join path',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								// BookAuthorJoin has a direct outgoing join to Book (IDBook)
								let tmpResult = _MeadowGraphClient.solveGraphConnections('BookAuthorJoin', 'Book');

								Expect(tmpResult.PotentialSolutions).to.be.an('Array');
								Expect(tmpResult.PotentialSolutions.length).to.be.greaterThan(0);
								Expect(tmpResult.OptimalSolutionPath).to.be.an('object');
								Expect(tmpResult.OptimalSolutionPath.EdgeAddress).to.equal('BookAuthorJoin-->Book');

								return fDone();
							}
						);

					test(
							'solveGraphConnections finds path through intermediary entities',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								// Book -> BookAuthorJoin -> Author (requires traversing a join table)
								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'Author');

								Expect(tmpResult.PotentialSolutions).to.be.an('Array');
								Expect(tmpResult.PotentialSolutions.length).to.be.greaterThan(0);
								Expect(tmpResult.OptimalSolutionPath).to.be.an('object');
								Expect(tmpResult.OptimalSolutionPath.EdgeAddress).to.equal('Book-->BookAuthorJoin-->Author');

								return fDone();
							}
						);

					test(
							'solveGraphConnections sets OptimalSolutionPath to the highest weight solution',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'Author');

								// OptimalSolutionPath should be the solution with the highest weight
								if (tmpResult.PotentialSolutions.length > 1)
								{
									for (let i = 1; i < tmpResult.PotentialSolutions.length; i++)
									{
										Expect(tmpResult.OptimalSolutionPath.Weight).to.be.greaterThanOrEqual(tmpResult.PotentialSolutions[i].Weight);
									}
								}
								Expect(tmpResult.OptimalSolutionPath).to.equal(tmpResult.PotentialSolutions[0]);

								return fDone();
							}
						);

					test(
							'solveGraphConnections handles entity hinting',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								// Solve with hints to favor the BookAuthorJoin path
								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'Author', ['BookAuthorJoin']);

								Expect(tmpResult.PotentialSolutions).to.be.an('Array');
								Expect(tmpResult.PotentialSolutions.length).to.be.greaterThan(0);
								Expect(tmpResult.OptimalSolutionPath.EdgeAddress).to.contain('BookAuthorJoin');

								// The hinted solution should have bonus weight
								Expect(tmpResult.OptimalSolutionPath.HintWeight).to.be.greaterThan(0);

								return fDone();
							}
						);

					test(
							'solveGraphConnections respects maximum traversal depth',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore, MaximumTraversalDepth: 1});

								// With max depth of 1, a 2-hop path (Book -> BookAuthorJoin -> Author) should not be solvable
								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'Author');

								Expect(tmpResult.PotentialSolutions).to.be.an('Array');
								Expect(tmpResult.PotentialSolutions).to.have.lengthOf(0);
								Expect(tmpResult.OptimalSolutionPath).to.equal(false);

								return fDone();
							}
						);

					test(
							'solveGraphConnections default hints are applied from configuration',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {
									DataModel: modelBookStore,
									DefaultHints: {
										'Book-->Author': ['BookAuthorJoin']
									}
								});

								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'Author');

								Expect(tmpResult.PotentialSolutions).to.be.an('Array');
								Expect(tmpResult.PotentialSolutions.length).to.be.greaterThan(0);
								Expect(tmpResult.OptimalSolutionPath.HintWeight).to.be.greaterThan(0);

								return fDone();
							}
						);

					test(
							'solveGraphConnections uses manual paths when defined',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let tmpManualPath = { Weight: 999999, EdgeAddress: 'ManualPath', RequestPath: [] };
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {
									DataModel: modelBookStore,
									DefaultManualPaths: {
										'Book-->Author': tmpManualPath
									}
								});

								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'Author');

								Expect(tmpResult.FromManualPath).to.equal(true);
								Expect(tmpResult.PotentialSolutions).to.have.lengthOf(1);
								Expect(tmpResult.PotentialSolutions[0].EdgeAddress).to.equal('ManualPath');

								return fDone();
							}
						);

					test(
							'solveGraphConnections finds direct Book->BookPrice path',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'BookPrice');

								Expect(tmpResult.PotentialSolutions).to.be.an('Array');
								Expect(tmpResult.PotentialSolutions.length).to.be.greaterThan(0);
								Expect(tmpResult.OptimalSolutionPath).to.be.an('object');
								// The direct 2-hop path (Book→BookPrice via incoming join) should be optimal
								Expect(tmpResult.OptimalSolutionPath.EdgeAddress).to.equal('Book-->BookPrice');

								return fDone();
							}
						);

					test(
							'solveGraphConnections allows destination to be reached from multiple directions',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								// Use the full bookstore model to create more possible paths
								let tmpModel = JSON.parse(JSON.stringify(modelBookStore));
								// Add a second route: Book->Review->BookPrice (via a fake join)
								tmpModel.Tables.Review.Columns.push({ Column: 'IDBookPrice', DataType: 'Numeric', Join: 'IDBookPrice' });
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: tmpModel});

								let tmpResult = _MeadowGraphClient.solveGraphConnections('Book', 'BookPrice');

								// Should find multiple solutions now (direct and via Review)
								Expect(tmpResult.PotentialSolutions.length).to.be.greaterThan(1);
								// The optimal path should still be the direct one with highest weight
								Expect(tmpResult.OptimalSolutionPath.EdgeAddress).to.equal('Book-->BookPrice');
								// Verify solutions are sorted by weight descending
								for (let i = 1; i < tmpResult.PotentialSolutions.length; i++)
								{
									Expect(tmpResult.PotentialSolutions[i - 1].Weight).to.be.greaterThanOrEqual(tmpResult.PotentialSolutions[i].Weight);
								}

								return fDone();
							}
						);
				}
			);

		suite
			(
				'Filter String Generation',
				() =>
				{
					test(
							'getFilterComparisonOperator maps operators correctly',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								Expect(_MeadowGraphClient.getFilterComparisonOperator('=')).to.equal('EQ');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('!=')).to.equal('NE');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('>')).to.equal('GT');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('>=')).to.equal('GE');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('<')).to.equal('LT');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('<=')).to.equal('LE');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('LIKE')).to.equal('LK');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('NOT LIKE')).to.equal('NLK');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('IS NULL')).to.equal('IN');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('IS NOT NULL')).to.equal('NN');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('IN')).to.equal('INN');
								Expect(_MeadowGraphClient.getFilterComparisonOperator('(')).to.equal('FOP');
								Expect(_MeadowGraphClient.getFilterComparisonOperator(')')).to.equal('FCP');
								// Unknown operators pass through
								Expect(_MeadowGraphClient.getFilterComparisonOperator('CUSTOM')).to.equal('CUSTOM');

								return fDone();
							}
						);

					test(
							'convertFilterObjectToFilterString generates proper meadow filter strings',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								let tmpFilterArray = [
									{ MeadowFilterType: 'FBV', Column: 'IDAuthor', Operator: '=', Value: 107 }
								];

								let tmpResult = _MeadowGraphClient.convertFilterObjectToFilterString(tmpFilterArray);
								Expect(tmpResult).to.equal('FBV~IDAuthor~EQ~107');

								return fDone();
							}
						);

					test(
							'convertFilterObjectToFilterString handles multiple filters with separators',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								let tmpFilterArray = [
									{ MeadowFilterType: 'FBV', Column: 'IDAuthor', Operator: '=', Value: 107 },
									{ MeadowFilterType: 'FBV', Column: 'Name', Operator: 'LIKE', Value: 'John%' }
								];

								let tmpResult = _MeadowGraphClient.convertFilterObjectToFilterString(tmpFilterArray);
								Expect(tmpResult).to.equal('FBV~IDAuthor~EQ~107~FBV~Name~LK~John%');

								return fDone();
							}
						);

					test(
							'convertFilterObjectToFilterString returns empty string for empty array',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {});

								Expect(_MeadowGraphClient.convertFilterObjectToFilterString([])).to.equal('');
								Expect(_MeadowGraphClient.convertFilterObjectToFilterString(null)).to.equal('');

								return fDone();
							}
						);
				}
			);

		suite
			(
				'Compiled Filter and Request Generation',
				() =>
				{
					test(
							'compileFilter returns false for invalid filter objects',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								// Missing Entity
								let tmpResult = _MeadowGraphClient.compileFilter({Filter: {}});
								Expect(tmpResult).to.equal(false);

								return fDone();
							}
						);

					test(
							'compileFilter generates correct request chains for multi-entity filters',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpResult = _MeadowGraphClient.compileFilter({
									Entity: 'Book',
									Filter: {
										'Author.IDAuthor': 42,
										'BookPrice.Discountable': true
									}
								});

								Expect(tmpResult).to.be.an('object');
								Expect(tmpResult.ParsedFilter).to.be.an('object');
								Expect(tmpResult.Requests).to.be.an('Array');
								Expect(tmpResult.Requests).to.have.lengthOf(2);

								// Verify entities in requests
								let tmpRequestEntities = tmpResult.Requests.map((r) => r.Entity);
								Expect(tmpRequestEntities).to.include('Author');
								Expect(tmpRequestEntities).to.include('BookPrice');

								// Each request should have a MeadowFilter string
								tmpResult.Requests.forEach((pRequest) =>
								{
									Expect(pRequest.MeadowFilter).to.be.a('string');
									Expect(pRequest.GraphRequestChain).to.be.an('Array');
								});

								return fDone();
							}
						);

					test(
							'compileFilter handles filter with only pivotal entity columns',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpResult = _MeadowGraphClient.compileFilter({
									Entity: 'Book',
									Filter: {
										'Title': 'Test%'
									}
								});

								Expect(tmpResult).to.be.an('object');
								// Only the pivotal entity filter, no cross-entity requests needed
								Expect(tmpResult.Requests).to.have.lengthOf(0);

								return fDone();
							}
						);
				}
			);

		suite
			(
				'GET Operation',
				() =>
				{
					test(
							'get returns error for invalid filter',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								_MeadowGraphClient.get({Filter: {}},
									(pError, pResult) =>
									{
										Expect(pError).to.be.an('Error');
										return fDone();
									}
								);
							}
						);

					test(
							'get successfully processes a valid multi-entity filter',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								_MeadowGraphClient.get(
									{
										Entity: 'Book',
										Filter: {
											'Author.IDAuthor': 107,
											'BookPrice.Discountable': true
										}
									},
									(pError, pCompiledGraphRequest) =>
									{
										Expect(pError).to.not.be.ok;
										Expect(pCompiledGraphRequest.Requests).to.be.an('Array');
										Expect(pCompiledGraphRequest.RequestPaths['Author'].OptimalSolutionPath.EdgeAddress).to.equal('Book-->BookAuthorJoin-->Author');
										return fDone();
									}
								);
							}
						);

					test(
							'get works with filter containing only pivotal entity columns',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								_MeadowGraphClient.get(
									{
										Entity: 'Book',
										Filter: {
											'Title': 'Great%'
										}
									},
									(pError, pCompiledGraphRequest) =>
									{
										Expect(pError).to.not.be.ok;
										Expect(pCompiledGraphRequest.Requests).to.have.lengthOf(0);
										return fDone();
									}
								);
							}
						);
				}
			);

		suite
			(
				'DataRequest Service',
				() =>
				{
					test(
							'DataRequest service can be instantiated',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphDataRequest', libMeadowGraphDataRequest);
								let _DataRequest = _Fable.instantiateServiceProvider('MeadowGraphDataRequest');

								Expect(_DataRequest).to.be.an('object');
								Expect(_DataRequest.serviceType).to.equal('MeadowGraphClientDataRequest');

								return fDone();
							}
						);

					test(
							'DataRequest getJSON calls through the lifecycle methods',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphDataRequest', libMeadowGraphDataRequest);
								let _DataRequest = _Fable.instantiateServiceProvider('MeadowGraphDataRequest');

								let tmpBeforeCalled = false;
								let tmpDoCalled = false;
								let tmpAfterCalled = false;

								_DataRequest.onBeforeGetJSON = (pURL, fCb) =>
								{
									tmpBeforeCalled = true;
									return fCb();
								};
								_DataRequest.doGetJSON = (pURL, fCb) =>
								{
									tmpDoCalled = true;
									return fCb(null, {result: 'test'});
								};
								_DataRequest.onAfterGetJSON = (pURL, pError, pResponse, fCb) =>
								{
									tmpAfterCalled = true;
									return fCb(pError, pResponse);
								};

								_DataRequest.getJSON('/test/url',
									(pError, pData) =>
									{
										Expect(tmpBeforeCalled).to.equal(true);
										Expect(tmpDoCalled).to.equal(true);
										Expect(tmpAfterCalled).to.equal(true);
										Expect(pData.result).to.equal('test');
										return fDone();
									});
							}
						);

					test(
							'DataRequest postJSON calls through the lifecycle methods',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphDataRequest', libMeadowGraphDataRequest);
								let _DataRequest = _Fable.instantiateServiceProvider('MeadowGraphDataRequest');

								let tmpBeforeCalled = false;
								let tmpDoCalled = false;

								_DataRequest.onBeforePostJSON = (pURL, pData, fCb) =>
								{
									tmpBeforeCalled = true;
									return fCb();
								};
								_DataRequest.doPostJSON = (pURL, pData, fCb) =>
								{
									tmpDoCalled = true;
									return fCb(null, {posted: true});
								};

								_DataRequest.postJSON('/test/url', {some: 'data'},
									(pError, pData) =>
									{
										Expect(tmpBeforeCalled).to.equal(true);
										Expect(tmpDoCalled).to.equal(true);
										Expect(pData.posted).to.equal(true);
										return fDone();
									});
							}
						);

					test(
							'DataRequest putJSON calls through the lifecycle methods',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphDataRequest', libMeadowGraphDataRequest);
								let _DataRequest = _Fable.instantiateServiceProvider('MeadowGraphDataRequest');

								let tmpBeforeCalled = false;
								let tmpDoCalled = false;

								_DataRequest.onBeforePutJSON = (pURL, pData, fCb) =>
								{
									tmpBeforeCalled = true;
									return fCb();
								};
								_DataRequest.doPutJSON = (pURL, pData, fCb) =>
								{
									tmpDoCalled = true;
									return fCb(null, {updated: true});
								};

								_DataRequest.putJSON('/test/url', {some: 'data'},
									(pError, pData) =>
									{
										Expect(tmpBeforeCalled).to.equal(true);
										Expect(tmpDoCalled).to.equal(true);
										Expect(pData.updated).to.equal(true);
										return fDone();
									});
							}
						);

					test(
							'DataRequest is automatically registered when MeadowGraphClient is instantiated',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient');

								Expect(_Fable.servicesMap).to.have.property('MeadowGraphClientDataRequest');

								return fDone();
							}
						);
				}
			);

		suite
			(
				'Connection Graph Integrity',
				() =>
				{
					test(
							'Entity columns are stored in KnownEntities',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								// Verify column data is stored
								Expect(_MeadowGraphClient._KnownEntities.Book).to.have.property('IDBook');
								Expect(_MeadowGraphClient._KnownEntities.Book).to.have.property('Title');
								Expect(_MeadowGraphClient._KnownEntities.Book.Title.DataType).to.equal('String');
								Expect(_MeadowGraphClient._KnownEntities.Book.IDBook.DataType).to.equal('ID');

								return fDone();
							}
						);

					test(
							'Outgoing and incoming connection lists match connection maps',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								// For every entity in OutgoingEntityConnections, the map and list should match
								let tmpOutgoingKeys = Object.keys(_MeadowGraphClient._OutgoingEntityConnections);
								for (let i = 0; i < tmpOutgoingKeys.length; i++)
								{
									let tmpEntityName = tmpOutgoingKeys[i];
									let tmpMapKeys = Object.keys(_MeadowGraphClient._OutgoingEntityConnections[tmpEntityName]);
									let tmpListKeys = _MeadowGraphClient._OutgoingEntityConnectionLists[tmpEntityName];

									Expect(tmpMapKeys.length).to.equal(tmpListKeys.length);
									for (let j = 0; j < tmpMapKeys.length; j++)
									{
										Expect(tmpListKeys).to.include(tmpMapKeys[j]);
									}
								}

								return fDone();
							}
						);

					test(
							'BookAuthorJoin has outgoing connections to both Book and Author',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								Expect(_MeadowGraphClient._OutgoingEntityConnections.BookAuthorJoin).to.have.property('Book');
								Expect(_MeadowGraphClient._OutgoingEntityConnections.BookAuthorJoin).to.have.property('Author');

								return fDone();
							}
						);

					test(
							'Review has outgoing connection to Book',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								Expect(_MeadowGraphClient._OutgoingEntityConnections.Review).to.have.property('Book');

								return fDone();
							}
						);
				}
			);

		suite
			(
				'Request Path Generation',
				() =>
				{
					test(
							'generateRequestPath creates valid request chain from solved path',
							(fDone) =>
							{
								let _Fable = new libFable();
								_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
								let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});

								let tmpSolution = _MeadowGraphClient.solveGraphConnections('Book', 'Author');

								Expect(tmpSolution.OptimalSolutionPath).to.be.an('object');
								Expect(tmpSolution.OptimalSolutionPath.RequestPath).to.be.an('Array');
								Expect(tmpSolution.OptimalSolutionPath.RequestPath.length).to.be.greaterThan(0);

								// Request path should go from endpoint (Author) back to base (Book)
								tmpSolution.OptimalSolutionPath.RequestPath.forEach((pRequest) =>
								{
									Expect(pRequest).to.have.property('Entity');
									Expect(pRequest).to.have.property('Depth');
									Expect(pRequest).to.have.property('DataSet');
								});

								return fDone();
							}
						);
				}
			);
	}
);
