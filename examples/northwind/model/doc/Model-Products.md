##### {DocumentationIndex|Home} > {Model/DataModel|Data Model} > {Model/Dictionary/Dictionary|Data Dictionary} > {Model/Dictionary/Model-Products|Products Table}

Products
===

Column Name | Size | Data Type | Join 
----------- | ---: | --------- | ---- 
ProductID |  | ID |  
ProductName | 40 | String |  
SupplierID |  | ForeignKey | Suppliers.SupplierID 
CategoryID |  | ForeignKey | Categories.CategoryID 
QuantityPerUnit | 20 | String |  
UnitPrice | 10,4 | Decimal |  
UnitsInStock | int | Numeric |  
UnitsOnOrder | int | Numeric |  
ReorderLevel | int | Numeric |  
Discontinued | int | Numeric |  
- - -

Generated on 2024-11-17 at 14:44
