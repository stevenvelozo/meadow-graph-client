-- Data Model -- Generated 2024-11-17T22:44:27.535Z

-- This script creates the following tables:
-- Table ----------------------------------------- Column Count ----------------
--   Categories                                              3
--   CustomerCustomerDemo                                    2
--   CustomerDemographics                                    2
--   Customers                                              11
--   Employees                                              17
--   EmployeeTerritories                                     2
--   OrderDetails                                            5
--   Orders                                                 14
--   Products                                               10
--   Region                                                  2
--   Shippers                                                3
--   Suppliers                                              12
--   Territories                                             2



--   [ Categories ]
CREATE TABLE IF NOT EXISTS
    Categories
    (
        CategoryID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        CategoryName CHAR(15) NOT NULL DEFAULT '',
        Description TEXT,

        PRIMARY KEY (CategoryID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ CustomerCustomerDemo ]
CREATE TABLE IF NOT EXISTS
    CustomerCustomerDemo
    (
        CustomerID INT NOT NULL DEFAULT '0',
        CustomerTypeID INT NOT NULL DEFAULT '0'
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ CustomerDemographics ]
CREATE TABLE IF NOT EXISTS
    CustomerDemographics
    (
        CustomerTypeID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        CustomerDesc TEXT,

        PRIMARY KEY (CustomerTypeID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Customers ]
CREATE TABLE IF NOT EXISTS
    Customers
    (
        CustomerID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        CompanyName CHAR(40) NOT NULL DEFAULT '',
        ContactName CHAR(30) NOT NULL DEFAULT '',
        ContactTitle CHAR(30) NOT NULL DEFAULT '',
        Address CHAR(60) NOT NULL DEFAULT '',
        City CHAR(15) NOT NULL DEFAULT '',
        Region CHAR(15) NOT NULL DEFAULT '',
        PostalCode CHAR(10) NOT NULL DEFAULT '',
        Country CHAR(15) NOT NULL DEFAULT '',
        Phone CHAR(24) NOT NULL DEFAULT '',
        Fax CHAR(24) NOT NULL DEFAULT '',

        PRIMARY KEY (CustomerID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Employees ]
CREATE TABLE IF NOT EXISTS
    Employees
    (
        EmployeeID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        LastName CHAR(20) NOT NULL DEFAULT '',
        FirstName CHAR(10) NOT NULL DEFAULT '',
        Title CHAR(30) NOT NULL DEFAULT '',
        TitleOfCourtesy CHAR(25) NOT NULL DEFAULT '',
        BirthDate DATETIME,
        HireDate DATETIME,
        Address CHAR(60) NOT NULL DEFAULT '',
        City CHAR(15) NOT NULL DEFAULT '',
        Region CHAR(15) NOT NULL DEFAULT '',
        PostalCode CHAR(10) NOT NULL DEFAULT '',
        Country CHAR(15) NOT NULL DEFAULT '',
        HomePhone CHAR(24) NOT NULL DEFAULT '',
        Extension CHAR(4) NOT NULL DEFAULT '',
        Notes TEXT,
        PhotoPath CHAR(255) NOT NULL DEFAULT '',
        Salary DECIMAL(10,3),

        PRIMARY KEY (EmployeeID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ EmployeeTerritories ]
CREATE TABLE IF NOT EXISTS
    EmployeeTerritories
    (
        EmployeeID INT UNSIGNED NOT NULL DEFAULT '0',
        TerritoryID INT UNSIGNED NOT NULL DEFAULT '0',

        PRIMARY KEY (TerritoryID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ OrderDetails ]
CREATE TABLE IF NOT EXISTS
    OrderDetails
    (
        OrderID INT NOT NULL DEFAULT '0',
        ProductID INT NOT NULL DEFAULT '0',
        UnitPrice DECIMAL(10,4),
        Quantity INT NOT NULL DEFAULT '0',
        Discount DECIMAL(8,0)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Orders ]
CREATE TABLE IF NOT EXISTS
    Orders
    (
        OrderID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        CustomerID INT UNSIGNED NOT NULL DEFAULT '0',
        EmployeeID INT UNSIGNED NOT NULL DEFAULT '0',
        OrderDate DATETIME,
        RequiredDate DATETIME,
        ShippedDate DATETIME,
        ShipVia INT NOT NULL DEFAULT '0',
        Freight DECIMAL(10,4),
        ShipName CHAR(40) NOT NULL DEFAULT '',
        ShipAddress CHAR(60) NOT NULL DEFAULT '',
        ShipCity CHAR(15) NOT NULL DEFAULT '',
        ShipRegion CHAR(15) NOT NULL DEFAULT '',
        ShipPostalCode CHAR(10) NOT NULL DEFAULT '',
        ShipCountry CHAR(15) NOT NULL DEFAULT '',

        PRIMARY KEY (EmployeeID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Products ]
CREATE TABLE IF NOT EXISTS
    Products
    (
        ProductID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        ProductName CHAR(40) NOT NULL DEFAULT '',
        SupplierID INT UNSIGNED NOT NULL DEFAULT '0',
        CategoryID INT UNSIGNED NOT NULL DEFAULT '0',
        QuantityPerUnit CHAR(20) NOT NULL DEFAULT '',
        UnitPrice DECIMAL(10,4),
        UnitsInStock INT NOT NULL DEFAULT '0',
        UnitsOnOrder INT NOT NULL DEFAULT '0',
        ReorderLevel INT NOT NULL DEFAULT '0',
        Discontinued INT NOT NULL DEFAULT '0',

        PRIMARY KEY (CategoryID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Region ]
CREATE TABLE IF NOT EXISTS
    Region
    (
        RegionID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        RegionDescription CHAR(50) NOT NULL DEFAULT '',

        PRIMARY KEY (RegionID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Shippers ]
CREATE TABLE IF NOT EXISTS
    Shippers
    (
        ShipperID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        CompanyName CHAR(40) NOT NULL DEFAULT '',
        Phone CHAR(24) NOT NULL DEFAULT '',

        PRIMARY KEY (ShipperID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Suppliers ]
CREATE TABLE IF NOT EXISTS
    Suppliers
    (
        SupplierID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        CompanyName CHAR(40) NOT NULL DEFAULT '',
        ContactName CHAR(30) NOT NULL DEFAULT '',
        ContactTitle CHAR(30) NOT NULL DEFAULT '',
        Address CHAR(60) NOT NULL DEFAULT '',
        City CHAR(15) NOT NULL DEFAULT '',
        RegionID INT UNSIGNED NOT NULL DEFAULT '0',
        PostalCode CHAR(10) NOT NULL DEFAULT '',
        Country CHAR(15) NOT NULL DEFAULT '',
        Phone CHAR(24) NOT NULL DEFAULT '',
        Fax CHAR(24) NOT NULL DEFAULT '',
        HomePage TEXT,

        PRIMARY KEY (RegionID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



--   [ Territories ]
CREATE TABLE IF NOT EXISTS
    Territories
    (
        TerritoryID INT UNSIGNED NOT NULL AUTO_INCREMENT,
        TerritoryDescription CHAR(50) NOT NULL DEFAULT '',

        PRIMARY KEY (TerritoryID)
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
