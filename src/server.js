// Import the 'express' package, which is the core of our server.
// It's the only mandatory dependency for a functional Express server.
const express = require('express');
const cors = require('cors')

// The 'dotenv' package is used to load environment variables from a .env file.
// This is a best practice for managing configuration and sensitive data.
// You must install it with 'npm install dotenv' and create a .env file.
require('dotenv').config();

// Create an instance of the Express application.
const app = express();


app.use(cors({ origin: 'http://127.0.0.1:5500' }));

// Set the port for the server to listen on. We use the PORT environment variable
// if it's set, otherwise we default to 3000.
const PORT = process.env.PORT || 3000;

// Middleware configuration
// Use the built-in Express middleware to parse incoming JSON payloads.
// This is necessary to handle JSON data sent in the request body (e.g., for POST requests).
app.use(express.json());

const registerationRoutes = require('./routes/studentRegisterationRoutes')

// Example of a basic route for the root URL ('/').
// When a GET request is made to the root, the server responds with a simple message.
app.use('/registeration', registerationRoutes);


// Start the server and listen for incoming requests on the specified port.
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
