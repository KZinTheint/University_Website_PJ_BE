const newsService = require('../services/newsService');

const getAllNews = async (req, res) => {
    try {
        const result = await newsService.getAllNews();
        if (result.success) {
            res.status(200).json({success: true, data: {news: result.data}});
        } else {
            res.status(500).json({ message: result.message });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching news', error: error.message });
    }
};

const getNewsById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await newsService.getNewsById(id);
        if (!result.success) return res.status(404).json({ message: 'News not found' });
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching news', error: error.message });
    }
};

const createNews = async (req, res) => {
    try {
        const result = await newsService.createNews(req.body, req.files);
        if (result.success) {
            res.status(201).json({ success: true, data: result.data, message: 'News created successfully' });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error creating news', error: error.message });
    }
};

const updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await newsService.updateNews(id, req.body, req.files);
        if (!result.success) return res.status(404).json({ message: 'News not found or update failed' });
        res.status(200).json(result.data);
    } catch (error) {
        res.status(500).json({ message: 'Error updating news', error: error.message });
    }
};

const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await newsService.deleteNews(id);
        if (result.success) return res.status(204).send();
        res.status(500).json({ message: result.message });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting news', error: error.message });
    }
};

const deleteFile = async (req, res) => {
    try {
        const fileUrl = req.query.url;
        if (!fileUrl) return res.status(400).json({ message: 'File URL is required' });
        const result = await newsService.deleteFileByUrl(fileUrl);
        if (result.success) return res.status(200).json({ message: 'File deleted successfully' });
        res.status(500).json({ message: result.message });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting file', error: error.message });
    }
};

module.exports = {
    getAllNews,
    getNewsById,
    createNews,
    updateNews,
    deleteNews,
    deleteFile
};
