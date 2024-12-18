!Categories
@CategoryID
$CategoryName 15
*Description

!CustomerCustomerDemo
#CustomerID -> CustomerID
#CustomerTypeID -> CustomerTypeID

!CustomerDemographics
@CustomerTypeID
*CustomerDesc

!Customers
@CustomerID
$CompanyName 40
$ContactName 30
$ContactTitle 30
$Address 60
$City 15
$Region 15
$PostalCode 10
$Country 15
$Phone 24
$Fax 24

!Employees
@EmployeeID
$LastName 20
$FirstName 10
$Title 30
$TitleOfCourtesy 25
&BirthDate
&HireDate
$Address 60
$City 15
$Region 15
$PostalCode 10
$Country 15
$HomePhone 24
$Extension 4
*Notes
$PhotoPath 255
.Salary

!EmployeeTerritories
~EmployeeID -> EmployeeID
~TerritoryID -> TerritoryID

!OrderDetails
#OrderID -> OrderID
#ProductID -> ProductID
.UnitPrice 10,4
#Quantity
.Discount 8,0

!Orders
@OrderID
~CustomerID -> CustomerID
~EmployeeID -> EmployeeID
&OrderDate
&RequiredDate
&ShippedDate
#ShipVia -> ShipperID
.Freight 10,4
$ShipName 40
$ShipAddress 60
$ShipCity 15
$ShipRegion 15
$ShipPostalCode 10
$ShipCountry 15

!Products
@ProductID
$ProductName 40
~SupplierID -> SupplierID
~CategoryID -> CategoryID
$QuantityPerUnit 20
.UnitPrice 10,4
#UnitsInStock
#UnitsOnOrder
#ReorderLevel
#Discontinued

!Region
@RegionID
$RegionDescription 50

!Shippers
@ShipperID
$CompanyName 40
$Phone 24

!Suppliers
@SupplierID
$CompanyName 40
$ContactName 30
$ContactTitle 30
$Address 60
$City 15
~RegionID -> RegionID
$PostalCode 10
$Country 15
$Phone 24
$Fax 24
*HomePage

!Territories
@TerritoryID
$TerritoryDescription 50

