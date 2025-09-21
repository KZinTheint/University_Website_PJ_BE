const express = require('express');
const router = express.Router();
const multer = require('multer');
const eventController = require('../controllers/eventController');


const upload = multer(); 
// GET all events
router.get('/', eventController.getAllEvents);

// GET a single event by ID
router.get('/:id', eventController.getEventById);

// POST a new event
router.post('/', upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
]), eventController.createEvent);
// PUT to update an event
router.put(
  '/:id',
  upload.fields([
    { name: 'cover_image', maxCount: 1 },
    { name: 'images', maxCount: 10 },
  ]),
  eventController.updateEvent
);

// DELETE an event
router.delete('/image', eventController.deleteImage)


router.delete('/:id', eventController.deleteEvent);

module.exports = router;
