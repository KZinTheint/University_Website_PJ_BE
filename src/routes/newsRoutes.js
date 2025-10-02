const express = require('express');
const router = express.Router();
const multer = require('multer');
const newsController = require('../controllers/newsController');

const upload = multer(); 

// GET all news
router.get('/', newsController.getAllNews);

// GET a single news item by ID
router.get('/:id', newsController.getNewsById);

// POST a new news item
router.post('/', upload.fields([
    { name: 'cover_image', maxCount: 1},
    { name: 'images', maxCount: 10 },
    { name: 'files', maxCount: 10 }
]), newsController.createNews);

// PUT to update a news item
router.put('/:id', upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'files', maxCount: 10 }
]), newsController.updateNews);

// DELETE an image or file
router.delete('/file', newsController.deleteFile);

// DELETE a news item
router.delete('/:id', newsController.deleteNews);

module.exports = router;
