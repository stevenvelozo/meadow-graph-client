const libFable = require('fable');

const libMeadowGraphClient = require(`../source/Meadow-Graph-Client.js`);
const modelBookStore = require(`../test/model/Retold-SampleData-Bookstore.json`);

let _Fable = new libFable();

_Fable.addServiceType('MeadowGraphClient', libMeadowGraphClient);

let _MeadowGraphClient = _Fable.instantiateServiceProvider('MeadowGraphClient', {DataModel: modelBookStore});




