const express = require("express");
const session = require("express-session");
const path = require("path");
const qrCode = require("qrcode");
const PDFDocument = require("pdfkit");
const sql = require("mssql"); 
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: false,
  })
);


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


const dbConfig = {
  server: "LAPTOP-3L3HS8MB\\SQLEXPRESS", // Use your instance name
  port: 1433,
  database: "Vouchers",
  user: "sa", // Your SQL Server username
  password: "123456", // Your SQL Server password
  options: {
    encrypt: false, // Disable encryption
    trustServerCertificate: true, // Trust the server certificate
  },
};

async function connectToDb() {
  try {
    const pool = await sql.connect(dbConfig);
    return pool;
  } catch (err) {
    console.error("Error connecting to DB:", err);
    throw err;
  }
}

sql.connect(dbConfig, (err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Connected to SQL Server successfully.");
  }
});

// username and password
const validUsername = "admin";
const validPassword = "admin";

let settings = {
  title: "Voucher Details",
  expiryDuration: 1,
  voucherWidth: 100,
  voucherHeight: 50,
  fontSize: 12,
};

function isAuthenticated(req, res, next) {
  if (req.session.username) {
    return next();
  }
  res.redirect("/");
}


app.get("/", (req, res) => {
  if (req.session.username) {
    return res.redirect("/dashboard");
  }
  res.render("login");
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === validUsername && password === validPassword) {
    req.session.username = username;
    res.redirect("/dashboard");
  } else {
    res.render("login", { error: "Invalid login credentials" });
  }
});

app.get("/dashboard", isAuthenticated, async (req, res) => {
  const successMessage = req.session.successMessage; 
  req.session.successMessage = null; 

  try {
    const pool = await connectToDb();
    const result = await pool
      .request()
      .query(
        "SELECT ID, Title, VoucherNumber, GeneratedDate, ExpiryDate, QRCodeUrl FROM [Vouchers].[dbo].[Vouchers]"
      );

    const formattedVouchers = result.recordset.map((voucher) => ({
      title: voucher.Title,
      voucherNumber: voucher.VoucherNumber,
      generatedDate: voucher.GeneratedDate
        ? new Date(voucher.GeneratedDate).toLocaleString()
        : "N/A",
      expiryDate: voucher.ExpiryDate
        ? new Date(voucher.ExpiryDate).toLocaleString()
        : "N/A",
      qrCodeUrl: voucher.QRCodeUrl || "",
    }));

    res.render("index", {
      username: req.session.username,
      vouchers: formattedVouchers,
      successMessage: successMessage || null,
    });
  } catch (err) {
    console.error("Error fetching vouchers from DB:", err);
    res.send("Error fetching vouchers");
  }
});

app.post("/generateQR", isAuthenticated, (req, res) => {
  const voucherNumber = Math.floor(Math.random() * 10000000000);
  const generatedDate = new Date();
  const expiryDate = new Date(generatedDate);
  expiryDate.setMonth(expiryDate.getMonth() + settings.expiryDuration); 

  const title = settings.title; 

  qrCode.toDataURL(voucherNumber.toString(), async (err, qrCodeUrl) => {
    if (err) {
      console.error("Error generating QR code:", err);
      return;
    }

    try {
      const pool = await connectToDb();
      await pool
        .request()
        .input("Title", sql.NVarChar, title)
        .input("VoucherNumber", sql.BigInt, voucherNumber)
        .input("GeneratedDate", sql.DateTime, generatedDate)
        .input("ExpiryDate", sql.DateTime, expiryDate)
        .input("QRCodeUrl", sql.NVarChar, qrCodeUrl)
        .query(
          "INSERT INTO [Vouchers].[dbo].[Vouchers] (Title, VoucherNumber, GeneratedDate, ExpiryDate, QRCodeUrl) VALUES (@Title, @VoucherNumber, @GeneratedDate, @ExpiryDate, @QRCodeUrl)"
        );

      req.session.successMessage = "Voucher generated successfully!";
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Error saving voucher to DB:", err);
      res.send("Error saving voucher to database");
    }
  });
});

app.get("/generatePDF/:voucherNumber", isAuthenticated, async (req, res) => {
  const voucherNumber = parseInt(req.params.voucherNumber);

  try {
    const pool = await connectToDb();
    const result = await pool
      .request()
      .input("VoucherNumber", sql.BigInt, voucherNumber)
      .query(
        "SELECT [ID], [Title], [VoucherNumber], [GeneratedDate], [ExpiryDate], [QRCodeUrl] FROM [Vouchers].[dbo].[Vouchers] WHERE VoucherNumber = @VoucherNumber"
      );

    const voucher = result.recordset[0];

    if (!voucher) {
      return res.send("Voucher not found");
    }

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=voucher.pdf");

    doc.pipe(res);
    doc.fontSize(20).text(voucher.Title, { align: "center" });
    doc
      .fontSize(settings.fontSize)
      .text(`Voucher Number: ${voucher.VoucherNumber}`, { align: "left" });
    doc.text(
      `Generated Date: ${new Date(voucher.GeneratedDate).toLocaleString()}`,
      { align: "left" }
    );
    doc.text(`Expiry Date: ${new Date(voucher.ExpiryDate).toLocaleString()}`, {
      align: "left",
    });
    doc.image(voucher.QRCodeUrl, {
      width: settings.voucherWidth,
      align: "center",
    });
    doc.end();
  } catch (err) {
    console.error("Error generating PDF:", err);
    res.send("Error generating PDF");
  }
});

app.get("/settings", isAuthenticated, (req, res) => {
  res.render("settings", { settings });
});

app.post("/settings", isAuthenticated, (req, res) => {
  const { title, expiryDuration, voucherWidth, voucherHeight, fontSize } =
    req.body;

  settings.title = title;
  settings.expiryDuration = parseInt(expiryDuration);
  settings.voucherWidth = parseInt(voucherWidth);
  settings.voucherHeight = parseInt(voucherHeight);
  settings.fontSize = parseInt(fontSize);

  res.redirect("/settings");
});

app.post("/deleteVoucher/:voucherNumber", isAuthenticated, async (req, res) => {
  const voucherNumber = req.params.voucherNumber;

  try {
    const pool = await connectToDb();
    const result = await pool
      .request()
      .input("VoucherNumber", sql.BigInt, voucherNumber)
      .query(
        "DELETE FROM [Vouchers].[dbo].[Vouchers] WHERE VoucherNumber = @VoucherNumber"
      );

    if (result.rowsAffected[0] > 0) {
      req.session.successMessage = "Voucher deleted successfully!";
    } else {
      req.session.successMessage = "Voucher not found!";
    }

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Error deleting voucher:", err);
    res.send("Error deleting voucher");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});


app.listen(3000, () => console.log("Server running on http://localhost:3000"));
