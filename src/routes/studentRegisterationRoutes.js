const express = require('express');
const router = express.Router();
const multer = require('multer');
// Import the controller that contains the logic for our route.
const registerationController = require('../controllers/studentRegisterationController');

// Define the route for our API.
// A GET request to the root of this router (which will be /api/ based on server.js)
// will call the function in the helloController.


const upload = multer();

router.get('/', registerationController.getAllRegisetrationData)
  .post('/', upload.fields([
  { name: 'high-school-certificate', maxCount: 1 },
  { name: 'grade-12-marks-results', maxCount: 1 },
  { name: 'national-id-card', maxCount: 1 },
  { name: 'birth-certificate', maxCount: 1 },
  { name: 'medical-certificate', maxCount: 1 },
  { name: 'character-certificate', maxCount: 1 },
  { name: 'passport-photo', maxCount: 1 }
]), registerationController.handleRegistration);

// Export the router so it can be used by the main server file.
module.exports = router;

