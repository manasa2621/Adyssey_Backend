const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { put } = require("@vercel/blob");
const multer = require("multer"); // Use multer to handle file uploads

const saltRounds = 10;
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize PostgreSQL client
const pool = new Pool({
  user: "default",
  host: "ep-black-frog-a4xr3snz-pooler.us-east-1.aws.neon.tech",
  database: "verceldb",
  password: "XDbJ3PkwZA6v",
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
    sslmode: "require",
  },
});
const token = "vercel_blob_rw_R0V287wjn08aLJdj_dHfLgCYThU1alsJxpH5BzVtTfB1ESg";

console.log("Blob Token:", token);
// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Define Routes
app.get("/", (req, res) => {
  res.send("All good server is running");
});

app.post("/employees", async (req, res) => {
  const { first_name, last_name, email, company_name, role, password } =
    req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newEmployee = await pool.query(
      "INSERT INTO users (first_name, last_name, email, company_name, role, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [first_name, last_name, email, company_name, role, hashedPassword]
    );

    res.status(201).json(newEmployee.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const userQuery = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: "Account not registered" });
    }

    const user = userQuery.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    res.status(200).json({
      statuscode: 200,
      message: "Login successful",
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/employees", async (req, res) => {
  try {
    const employees = await pool.query("SELECT * FROM users");
    res.status(200).json(employees.rows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/trucking", async (req, res) => {
  const {
    vehicleNumber,
    vehicleType,
    registrationNumber,
    vehicleDimention,
    vehicleRoute,
    insuranceUrl,
    taxUrl,
    rcUrl,
    email,
  } = req.body;

  try {
    const newTruckingEntry = await pool.query(
      "INSERT INTO trucking (vehicle_number, vehicle_type, registration_number, vehicle_dimention, vehicle_route, insurance_url, tax_url, rc_url, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [
        vehicleNumber,
        vehicleType,
        registrationNumber,
        vehicleDimention,
        vehicleRoute,
        insuranceUrl,
        taxUrl,
        rcUrl,
        email,
      ]
    );

    res.status(201).json(newTruckingEntry.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { originalname, buffer } = req.file;
    const { url } = await put(originalname, buffer, {
      access: "public",
      token: token,
    });

    res.status(200).json({ url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/trucking', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM trucking');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching trucking data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
