# Test Harness for Graph Client

This allows us to exercise different moving parts of the graph client on any 
JSON meadow model we want.

By default, the harness leverages the test model in:

```
test/model/Retold-SampleData-Bookstore.json
```

If you want to use a different model, the easiest way is to copy it to a
file `TestModel.json` in this folder, which is already in the repository
git ignore file.

## Getting a Visual Baseline to Compare To

To generate a visual graph of the meadow model, run the following:

```shell
npx stricture -i ./TestModel.json -c RelationshipsFull -g -l
```

...or if you want to skip the joins on auditing Users in the graph:

```shell
npx stricture -i ./TestModel.json -c Relationships -g -l
```

The gitignore also won't check in your model images.  The secrets are safe.

## Switching the Harness to Use Your Model

In the `Harness.js` file, lines 4-5 have the following:

```javascript
let meadowModel = require(`../test/model/Retold-SampleData-Bookstore.json`);
//meadowModel = require(`./TestModel.json`);
```

Just uncomment line 5 to load the `TestModel.json` rather than the built-in
model.
