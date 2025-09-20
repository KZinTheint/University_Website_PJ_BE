// Import the service that contains our business logic.
const registerationService = require('../services/studentRegisterationService');

// This is the controller function that handles the request and response.
// It calls a service function to get data, and then sends the response back to the client.
// This separation of concerns keeps the controller clean and focused on request/response handling.

const registerController = {

  async getAllRegisetrationData(req, res) {

    const result = await registerationService.getAllRegisetrationData()
    if (!result.success) {
      return res.status(400).json({
        result
      })

    }

    return res.status(200).json(result)

  },

  async handleRegistration(req, res) {
    try {
      // Extract data from the request body (text fields) and files
      const data = req.body;
      const files = req.files;

      console.log("in handler")

      // --- Basic Text Field Validation ---
      const requiredTextFields = [
        'first-name', 'last-name', 'dob', 'gender', 'nationality',
        'national-id-prefix', 'national-id-number', 'national-id-region', 'citizen-type',  'email', 'phone-number',
        'permanent-address', 'city', 'state-region', 'high-school-name',
        'high-school-marks', 'desired-program', 'emergency-contact-name',
        'emergency-contact-phone', 'emergency-contact-relationship'
      ];

      for (const field of requiredTextFields) {
        if (!data[field]) {
          console.error(`Validation Error: Missing required field - ${field}`);
          return res.status(400).json({ success: false, message: `Missing required field: ${field}` });
        }
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Specific field format validation
      if (!emailRegex.test(data.email)) {
        console.error('Validation Error: Invalid email format.');
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
      }

      const marks = parseInt(data['high-school-marks']);
      if (isNaN(marks) || marks < 0 || marks > 550) {
        console.error('Validation Error: Invalid high school marks.');
        return res.status(400).json({ success: false, message: 'High school marks must be a number between 0 and 550.' });
      }

      console.log(data.declaration, data['terms-and-conditions'])

      if (data.declaration !== 'on' || data['terms-and-conditions'] !== 'on') {
        console.error('Validation Error: Required declarations not accepted.');
        return res.status(400).json({ success: false, message: 'You must accept the declarations to register.' });
      }

      // --- File Validation ---
      const requiredFiles = [
        'high-school-certificate',
        'grade-12-marks-results',
        'national-id-card',
        'birth-certificate',
        'passport-photo'
      ];

      const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      const maxFileSize = 5 * 1024 * 1024; // 5MB

      for (const fileKey of requiredFiles) {
        if (!files[fileKey] || files[fileKey].length === 0) {
          console.error(`Validation Error: Missing required file - ${fileKey}`);
          return res.status(400).json({ success: false, message: `Missing required file: ${fileKey}` });
        }

        const file = files[fileKey][0];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          console.error(`Validation Error: Invalid file type for ${fileKey}.`);
          return res.status(400).json({ success: false, message: `Invalid file type for ${fileKey}. Only PDF, JPG, or PNG are allowed.` });
        }

        if (file.size > maxFileSize) {
          console.error(`Validation Error: File size too large for ${fileKey}.`);
          return res.status(400).json({ success: false, message: `File size for ${fileKey} exceeds 5MB.` });
        }
      }

      // If all validation passes, log the data.
      console.log('--- Successfully Received and Validated Registration Data ---');
      console.log('Text Fields:', data);
      console.log('\n--- Uploaded Files Information ---');
      for (const fileKey in files) {
        if (files[fileKey]) {
          console.log(`- ${fileKey}: Original Name: ${files[fileKey][0].originalname}, Size: ${files[fileKey][0].size} bytes`);
        }
      }

      const result = await registerationService.addRegistration(data, files);

      if (!result.success) {
        return res.status(400).json({ success: false, message: result.message });
      }

      res.status(200).json(result);
      console.log("resoinsed send")
    } catch (err) {
      console.error('An unexpected error occurred:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
  
  async deleteRegistrationsController(req, res) {
    const { ids } = req.body; 

    const result = await registerationService.deleteRegistrations(ids);
    res.status(result.success ? 200 : 400).json(result);
  },

  async getFile(req, res) {
    const registrationId = req.params.id;
    const fileName  = req.params.fileName
    const files = await registerationService.getSignedUrls(registrationId, fileName);
    res.json(files);
  }
}

module.exports = registerController
