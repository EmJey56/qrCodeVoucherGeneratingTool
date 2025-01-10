step 1 = npm install

step 2 = setup db(SQL Server)

	CREATE TABLE Vouchers (
    VoucherNumber BIGINT PRIMARY KEY,
    Title NVARCHAR(255),
    GeneratedDate DATETIME,
    ExpiryDate DATETIME,
    QRCodeUrl NVARCHAR(255)
);


use this query code in db to create table.

step 3 = add ure username and pass etc..

---------------------------------------------

Authentication for the frontend

username = admin
password = admin