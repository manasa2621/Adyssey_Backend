const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const cors = require("cors"); // Import the cors package
const bcrypt = require('bcrypt');
const saltRounds = 10;
// Initialize Express
const app = express();
app.use(bodyParser.json());
app.use(cors());

// Initialize PostgreSQL client
const pool = new Pool({
  user: "default",
  host: "ep-black-frog-a4xr3snz-pooler.us-east-1.aws.neon.tech",
  database: "verceldb",
  password: "XDbJ3PkwZA6v",
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
    sslmode: "require",
  },
});

// Define Routes
app.get("/", (req, res) => {
  res.send("All good server is running");
});

// Create a new employee

app.post("/employees", async (req, res) => {
  const { first_name, last_name, email, company_name, role, password } =
    req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert the new employee with the hashed password
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

// Get all employees
app.get("/employees", async (req, res) => {
  try {
    const employees = await pool.query("SELECT * FROM users");
    res.status(200).json(employees.rows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
