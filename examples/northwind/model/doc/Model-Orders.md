##### {DocumentationIndex|Home} > {Model/DataModel|Data Model} > {Model/Dictionary/Dictionary|Data Dictionary} > {Model/Dictionary/Model-Orders|Orders Table}

Orders
===

Column Name | Size | Data Type | Join 
----------- | ---: | --------- | ---- 
OrderID |  | ID |  
CustomerID |  | ForeignKey | Customers.CustomerID 
EmployeeID |  | ForeignKey | Employees.EmployeeID 
OrderDate |  | DateTime |  
RequiredDate |  | DateTime |  
ShippedDate |  | DateTime |  
ShipVia | int | Numeric | Shippers.ShipperID 
Freight | 10,4 | Decimal |  
ShipName | 40 | String |  
ShipAddress | 60 | String |  
ShipCity | 15 | String |  
ShipRegion | 15 | String |  
ShipPostalCode | 10 | String |  
ShipCountry | 15 | String |  
- - -

Generated on 2024-11-17 at 14:44
