const libFable = require('fable');

const libMeadowGraphClient = require(`../source/Meadow-Graph-Client.js`);
//const meadowModel = require(`../test/model/Retold-SampleData-Bookstore.json`);
const meadowModel = require(`./TestModel.json`);

let _Fable = new libFable();

_Fable.log.info(`Initializing MeadowGraphClient Service Provider`);

_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);
_Fable.log.info(`...data model contains ${meadowModel.Tables.length} tables`);
let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: meadowModel});
_Fable.log.info(`...instantiated MeadowGraphClient`);


let tmpFilterObject = {Entity: 'Bridge', Filter:{"BridgeElementConditionDefect.CS1Description": "Crack"}, Hints:['MaterialLineItemJoin']};
//let tmpFilterObject = {Entity: 'Bridge', Filter:{"BridgeElementConditionDefect.CS1Description": "Crack"}};

let tmpParsedFilterObject = _MeadowGraphClient.parseFilterObject(tmpFilterObject);

let tmpGraphTraversalObject = _MeadowGraphClient.solveGraphConnections(tmpFilterObject.Entity, 'BridgeElementConditionDefect', tmpFilterObject.Hints);

_Fable.log.info(`Operation Complete!`);