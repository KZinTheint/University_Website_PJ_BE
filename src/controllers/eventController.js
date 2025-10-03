const eventService = require('../services/eventService');

const getAllEvents = async (req, res) => {
    try {
        const events = await eventService.getAllEvents();
        res.status(200).json(events);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching events', error: error.message });
    }
};

const getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await eventService.getEventById(id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json(event);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching event', error: error.message });
    }
};

const createEvent = async (req, res) => {
    try {
        const result = await eventService.createEvent(req.body, req.files);

        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data,
                message: 'Event created successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message || 'Failed to create event'
            });
        }

    } catch (error) {
        console.error('Controller error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating event',
            error: error.message
        });
    }
};

const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedEvent = await eventService.updateEvent(id, req.body, req.files);
        if (!updatedEvent || updatedEvent.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json(updatedEvent);
    } catch (error) {
        res.status(500).json({ message: 'Error updating event', error: error.message });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const result  = await eventService.deleteEvent(id);
        console.log("result", result);
        return res.status(200).json(result); 
    } catch (error) {
        res.status(500).json({ message: 'Error deleting event', error: error.message });
    }
};

const deleteImage = async(req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ success: false, message: 'Image URL is required' });
  }
  
  const result = await eventService.deleteImageByUrl(imageUrl);
  if (result.success) {
    res.status(200).json({ success: true, message: 'Image deleted successfully' });
  } else {
    res.status(500).json({ success: false, message: result.message || 'Failed to delete image' });
  }
}

module.exports = {
    getAllEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    deleteImage,
};
