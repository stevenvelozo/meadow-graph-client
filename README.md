# meadow-graph-client

Meadow client pulling comprehensions of data from relational database graphs.

## Concepts

* Entity
* Filter
* Pagination
* Hints
* Ignores

## Preparation

Before any graph requests can be made, a data model needs to be loaded.

This can be done in three ways:

1. by passing in the data model as part of the service options in the `DataModel` property
2. as a direct function call with the meadow schema object to `graphClientService.loadDataModel(MyMeadowSchema);`
3. as discrete table adds with each meadow table schema you want to load with `graphClientService.addTableToDataModel(MyMeadowTableSchema);`

As these are loaded, the library creates the connection map for how
entities are connected to each other.

There are some meadow-specific nomenclatures that are used to hint the graph
creation and traversal:

1. identity columns are prefaced by `ID` -- for instance `IDBook`, `IDAuthoer`, etc. (and these correlate with the table name)
2. join tables are postfixed by `Join` -- for instance `BookAuthorJoin` is a join between `Book` and `Author`

By default the library ignores auditing columns (CreatingUserID,
UpdatingUserID, CustomerID, etc.) and will not use them to build graph
query lookups.

## Basic Algorithm

The graph traversal happens in a forwards then backwards manner, building
context and then resolving connections coming back.

1. Lint Filter Object
2. Parse the Filters
3. Generate the Request Graph
4. Perform the Request Graph outside in

## Some Complex Tasks

* Determining whether or not the filter is in the current entity (and if not, which one)
* Walk the graph of potential entities to apply the filter to, and scoring them (distance being a huge factor)
* Converting Filters to their complex filter descriptions *(this one is complex because it has to resolve based on ambiguity at times (for instance if you filter on `Name` but there is no `Name` column in the queried entity but three of the potential joins have a `Name` column... which is part of why there is hinting)*
* Once the graph requirements have been built, pull record sets in reverse-style *(for instance if I'm getting all Books by a specific Author Name, we will gather the Author first then the books and the join inbetween if that join exists in the data model)*

## Filters

* Each filter has a type
* Right now there are two types: `InRecord` and `Join`
* Filters have a comparison operator -- defaulted to Equal

## A simple direct search of an entity with equivalent filters

Longhand form:

```json
{
    Entity: 'Book',
    Filters: {
        Name: { FilterType: 'InRecord', Comparison: 'Equality', Value: 'Breakfast of Champions' }
    }
}
```

Shorthand form:

```json
{
    Entity: 'Book',
    Filters: {
        Name: 'Breakfast of Champions'
    }
}
```

Both of these resolve into:

```json
{
    Entity: 'Book',
    Filters: [
        {
            Hash: 'Name',
            Entity: 'Book',
            FilterType: 'InRecord',
            Column: 'Name',
            Comparison: 'Equality',
            Value: 'Breakfast Of Champions'
        }
    ]
}
```

Note that filters do not have to have the object key map to the Column name...
this is just a convenience for shorthand.  You can explicitly define the Column
as well with:

```json
{
    Entity: 'Book',
    Filters: {
        NameIsIrrelevant: { Column: 'Name', FilterType: 'InRecord', Comparison: 'Equality', Value: 'Breakfast of Champions' }
    }
}
```

Which will resolve to:

```json
{
    Entity: 'Book',
    Filters: ...one of the two Filters objects from above...,

    EntitiesToPull: ['Book']
    ParsedFilters: [
        {
            Hash: 'NameIsIrrelevant',
            FilterType: 'InRecord',
            Column: 'Name',
            Comparison: 'Equality',
            Value: 'Breakfast Of Champions',
        }
    ]
}
```

The possible (but not definite) correlation between Hash and Column adds
complexity.  And.  Gives an interesting interaction with Manyfests which
use a similar type of potential indirection.

## Some equivalent filters for an entity that is a single dimension away

Longhand form:

```json
{
    Entity: 'Book',
    Filters: {
        IDAuthor: { FilterType: 'Join', Value: 157 }
    }
}
```

Shorthand form:

```json
{
    Entity: 'Book',
    Filters: {
        IDAuthor: 157
    }
}
```
