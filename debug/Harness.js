const libFable = require('fable');

const libMeadowGraphClient = require(`../source/Meadow-Graph-Client.js`);
let meadowModel = require(`../test/model/Retold-SampleData-Bookstore.json`);
meadowModel = require(`./TestModel.json`);

let _Fable = new libFable();

_Fable.log.info(`Initializing MeadowGraphClient Service Provider`);

_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
_Fable.log.info(`...data model contains ${meadowModel.Tables.length} tables`);
let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: meadowModel});
_Fable.log.info(`...instantiated MeadowGraphClient`);

_MeadowGraphClient.cleanMissingEntityConnections();

let tmpFilterObject = {Entity: 'Book', Filter:{"Author.Name": "Dan Brown"}};
//tmpFilterObject = {Entity: 'Bridge', Filter:{"BridgeElementConditionDefect.Code": "1080"}};

let tmpParsedFilterObject = _MeadowGraphClient.parseFilterObject(tmpFilterObject);
//let tmpGraphTraversalObject = _MeadowGraphClient.solveGraphConnections(tmpFilterObject.Entity, 'Author', tmpFilterObject.Hints);
let tmpGraphTraversalObject = _MeadowGraphClient.solveGraphConnections('Test', 'Material', tmpFilterObject.Hints);

_Fable.log.info(`Operation Complete!`);