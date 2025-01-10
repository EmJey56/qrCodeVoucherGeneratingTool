"I developed this tool as part of a task provided by Auxwall Software 
Solutions to assess my suitability for the role, ensuring all specified 
requirements were fulfilled. Thankyou!"

-----------------------------------------
Backend :-
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
Frontend:-
Authentication

username = admin
password = admin
