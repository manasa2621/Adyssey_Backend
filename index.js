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
    // Query the user by email
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

    let role = user.role;

    if (role === "Partner") {
      // Check if the email exists in the trucking table
      const truckingQuery = await pool.query(
        "SELECT * FROM trucking WHERE email = $1",
        [email]
      );

      if (truckingQuery.rows.length > 0) {
        role = "user";
      }
    }

    res.status(200).json({
      statuscode: 200,
      message: "Login successful",
      role: role,
      company: user.company_name,
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

app.get("/home", async (req, res) => {
  const {email} = req.query;
  try {
    
    const routes = await pool.query('SELECT source, destination FROM trucking WHERE email = $1', [email]);
    res.status(200).json(routes.rows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/home", async (req, res) => {
    const { email,source,destination } = req.body;

    try {
      const updateStatus = await pool.query(
        "UPDATE trucking SET source = $1 ,destination=$2 WHERE email = $3 RETURNING *",
        [source,destination,email]
      );
  
      if (updateStatus.rowCount === 0) {
        return res.status(404).json({ error: "source not found" });
      }
  
      res.status(200).json(updateStatus.rows[0]);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

app.post("/trucking", async (req, res) => {
  const {
    vehicleNumber,
    vehicleType,
    registrationNumber,
    vehicle_source,
    vehicle_destination,
    insuranceUrl,
    taxUrl,
    rcUrl,
    email,
  } = req.body;

  try {
    const newTruckingEntry = await pool.query(
      "INSERT INTO trucking (vehicle_number, vehicle_type, registration_number, source, destination, insurance_url, tax_url, rc_url, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [
        vehicleNumber,
        vehicleType,
        registrationNumber,
        vehicle_source,
        vehicle_destination,
        insuranceUrl,
        taxUrl,
        rcUrl,
        email,
      ]
    );

    vehicle_source;

    res.status(201).json(newTruckingEntry.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/activate", async (req, res) => {
  const { vehicleNumber, status } = req.body;

  try {
    const updateStatus = await pool.query(
      "UPDATE trucking SET status = $1 WHERE vehicle_number = $2 RETURNING *",
      [status, vehicleNumber]
    );

    if (updateStatus.rowCount === 0) {
      return res.status(404).json({ error: "Vehicle not found" });
    }

    res.status(200).json(updateStatus.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upload route
app.post("/upload", upload.any(), async (req, res) => {
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

app.get("/trucking", async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
      CONCAT(users.first_name, ' ', users.last_name) AS name,
      users.company_name, trucking.vehicle_number, trucking.vehicle_type,trucking.registration_number,trucking.source,trucking.destination,trucking.insurance_url,trucking.tax_url,trucking.rc_url,trucking.status
  FROM 
     users
INNER JOIN
    trucking ON trucking.email = users.email;
`);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching trucking data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/count", async (req, res) => {
  const { company_name } = req.query;

  try {
    const countQuery = `
        SELECT 
          COUNT(DISTINCT trucking.email) AS total_vehicles,
          COUNT(DISTINCT CASE WHEN trucking.status = true THEN trucking.email END) AS active_vehicles
        FROM 
          users
        INNER JOIN
          trucking ON trucking.email = users.email
        WHERE 
          users.company_name = $1;
      `;

    const countResult = await pool.query(countQuery, [company_name]);

    res.status(200).json(countResult.rows[0]);
  } catch (error) {
    console.error("Error fetching trucking stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/user_profile", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Email query parameter is required" });
  }

  try {
    const result = await pool.query(
      `SELECT 
        CONCAT(users.first_name, ' ', users.last_name) AS name,
        users.company_name, 
        users.email,
        trucking.vehicle_number, 
        trucking.vehicle_type,
        trucking.registration_number,
        trucking.source,
        trucking.destination,
        trucking.insurance_url,
        trucking.tax_url,
        trucking.rc_url,
        trucking.status
      FROM 
        users
      INNER JOIN
        trucking ON trucking.email = users.email
      WHERE
        users.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/help", async (req, res) => {
  const { email, query } = req.body;

  try {
    // Insert new help request into the database
    const newHelpRequest = await pool.query(
      "INSERT INTO help (email, query) VALUES ($1, $2) RETURNING *",
      [email, query]
    );

    res.status(201).json(newHelpRequest.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/help", async (req, res) => {
  try {
    const queries = await pool.query("SELECT * FROM help");
    res.status(200).json(queries.rows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/help_response", async (req, res) => {
  const {email} = req.query;
  try {
    const queries = await pool.query("SELECT * FROM help where email=$1",[email]);
    res.status(200).json(queries.rows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/help", async (req, res) => {
const { email,response} = req.body;

try {
  const updateStatus = await pool.query(
    "UPDATE help SET response = $1  WHERE email = $2 RETURNING *",
    [response,email]
  );

  if (updateStatus.rowCount === 0) {
    return res.status(404).json({ error: "source not found" });
  }

  res.status(200).json(updateStatus.rows[0]);
} catch (error) {
  res.status(400).json({ error: error.message });
}
});

app.delete('/help', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required' });
  }

  try {
    // Perform the DELETE operation
    const result = await pool.query('DELETE FROM help WHERE email = $1 RETURNING *', [email]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No query found for the given email' });
    }

    res.status(200).json({ message: 'Query deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/help_response', async (req, res) => {
  const { id } = req.query;

  try {
    // Perform the DELETE operation
    const result = await pool.query('DELETE FROM help WHERE id = $1 RETURNING *', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'No query found for the given id' });
    }

    res.status(200).json({ message: 'Query deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.post("/update_profile", async (req, res) => {
  const {
    name,
    company_name,
    email,
    vehicle_number,
    vehicle_type,
    registration_number,
    insuranceUrl,
    taxUrl,
    rcUrl,
    status,
  } = req.body;

  try {
    const updateQuery = `
      UPDATE trucking 
      SET 
        vehicle_number = $1,
        vehicle_type = $2,
        registration_number = $3,
        insurance_url = $4,
        tax_url = $5,
        rc_url = $6,
        status = $7
      WHERE email = $8
    `;

    await pool.query(updateQuery, [
      vehicle_number,
      vehicle_type,
      registration_number,
      insuranceUrl,
      taxUrl,
      rcUrl,
      status,
      email,
    ]);

    const updateUserQuery = `
      UPDATE users
      SET 
        first_name = $1,
        last_name = $2,
        company_name = $3
      WHERE email = $4
    `;

    const [firstName, lastName] = name ? name.split(" ") : [""];

    await pool.query(updateUserQuery, [
      firstName,
      lastName,
      company_name,
      email,
    ]);

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start Server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
