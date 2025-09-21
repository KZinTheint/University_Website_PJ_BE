const { supabaseClient } = require('../lib/supabase');

const TABLE_NAME = 'events';

async function getSignedUrl(filePath) {
  const { data, error } = await supabaseClient
    .storage
    .from('events')
    .createSignedUrl(filePath, 60 * 60); // valid for 1 hour
  if (error) {
    console.error('Signed URL error:', error.message);
    return null;
  }
  return data.signedUrl;
}

const eventsService = {

  async getAllEvents() {
    try {
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select('*')
        .order('event_date', { ascending: false });

      if (error) return { success: false, message: error.message };

      const enriched = await Promise.all(
        data.map(async (event) => {
          const coverPath = `${event.id}/cover`;
          const albumPath = `${event.id}/album`;

          // Cover image
          const { data: coverFiles } = await supabaseClient.storage
            .from('events')
            .list(coverPath);
          const coverUrl = coverFiles?.[0]
            ? await getSignedUrl(`${coverPath}/${coverFiles[0].name}`)
            : null;

          // Album images
          const { data: albumFiles } = await supabaseClient.storage
            .from('events')
            .list(albumPath);
          const albumUrls = await Promise.all(
            (albumFiles || []).map((f) =>
              getSignedUrl(`${albumPath}/${f.name}`)
            )
          );

          return { ...event, cover_url: coverUrl, images: albumUrls };
        })
      );

      return { success: true, data: enriched };
    } catch (err) {
      console.error('Unexpected error in getAllEvents:', err);
      return { success: false, message: 'Unexpected error occurred' };
    }
  },

  async getEventById(id) {
    try {
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) return { success: false, message: error.message };

      const coverPath = `${id}/cover`;
      const albumPath = `${id}/album`;

      const { data: coverFiles } = await supabaseClient.storage
        .from('events')
        .list(coverPath);
      const coverUrl = coverFiles?.[0]
        ? await getSignedUrl(`${coverPath}/${coverFiles[0].name}`)
        : null;

      const { data: albumFiles } = await supabaseClient.storage
        .from('events')
        .list(albumPath);
      const albumUrls = await Promise.all(
        (albumFiles || []).map((f) =>
          getSignedUrl(`${albumPath}/${f.name}`)
        )
      );

      return {
        success: true,
        data: { ...data, cover_url: coverUrl, images: albumUrls },
      };
    } catch (err) {
      console.error('Unexpected error in getEventById:', err);
      return { success: false, message: 'Unexpected error occurred' };
    }
  },

  async createEvent(data, files) {
    try {
      // 1. Parse content JSON (optional)
      let content = [];
      if (data.content) {
        try {
          content = JSON.parse(data.content);
          // Ensure only up to 10 items
          content = content.slice(0, 10).map(item => ({
            subheading: item.subheading || null,
            description: item.description || null,
          }));
        } catch (err) {
          console.warn('Invalid content JSON, storing empty array');
        }
      }

      // 2. Prepare event row
      const eventRow = {
        title: data.title,
        event_date: data.event_date,
        content: content.length > 0 ? content : null,
      };

      // 3. Insert event row
      const { data: newEvent, error: insertError } = await supabaseClient
        .from(TABLE_NAME)
        .insert([eventRow])
        .select()
        .single();

      if (insertError) {
        return { success: false, message: insertError.message };
      }

      const eventId = newEvent.id;

      // 4. Helper to sanitize filenames
      const sanitizeFileName = (fileName) =>
        fileName
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9-_.]/g, '_');

      // 5. Upload cover image
      if (files.cover_image && files.cover_image[0]) {
        const coverFile = files.cover_image[0];
        const filePath = `${eventId}/cover/${sanitizeFileName(coverFile.originalname)}`;
        const { error: coverError } = await supabaseClient
          .storage
          .from('events')
          .upload(filePath, coverFile.buffer, {
            contentType: coverFile.mimetype,
            upsert: true,
          });
        if (coverError) {
          console.error('Cover image upload error:', coverError);
          return { success: false, message: 'Failed to upload cover image' };
        }
      }

      // 6. Upload other images (album)
      if (files.images) {
        for (const img of files.images.slice(0, 10)) { // max 10
          const filePath = `${eventId}/album/${sanitizeFileName(img.originalname)}`;
          const { error: imgError } = await supabaseClient
            .storage
            .from('events')
            .upload(filePath, img.buffer, {
              contentType: img.mimetype,
              upsert: true,
            });
          if (imgError) {
            console.error('Image upload error:', imgError);
            return { success: false, message: `Failed to upload image: ${img.originalname}` };
          }
        }
      }

      return { success: true, data: newEvent, message: 'Event created successfully' };

    } catch (err) {
      console.error('Unexpected error creating event:', err);
      return { success: false, message: 'Unexpected error occurred' };
    }
  },

  async updateEvent(id, eventData, files) {
    try {
      const content = {
        subheading: eventData.subheading || null,
        description: eventData.description || null,
      };

      const updateData = {
        title: eventData.title,
        content,
        event_date: eventData.event_date
      };

      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) throw new Error(error.message);

      // Helper to sanitize filenames
      const sanitizeFileName = (fileName) =>
        fileName
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9-_.]/g, '_');

      console.log(files)
      // Handle cover image update
      if (files.cover_image && files.cover_image[0]) {
        const coverFile = files.cover_image[0];
        const coverPath = `${id}/cover`;

        // 1. Delete existing cover image
        const { data: existingCover, error: listError } = await supabaseClient.storage
          .from('events')
          .list(coverPath);

        if (!listError && existingCover.length > 0) {
          await supabaseClient.storage
            .from('events')
            .remove([`${coverPath}/${existingCover[0].name}`]);
        }

        // 2. Upload new cover image
        const filePath = `${coverPath}/${sanitizeFileName(coverFile.originalname)}`;
        const { error: coverError } = await supabaseClient
          .storage
          .from('events')
          .upload(filePath, coverFile.buffer, {
            contentType: coverFile.mimetype,
            upsert: true,
          });
        if (coverError) {
          console.error('Cover image upload error:', coverError);
          return { success: false, message: 'Failed to upload new cover image' };
        }
      }

      // Handle new album image uploads
      if (files.images) {
        for (const img of files.images.slice(0, 10)) {
          const filePath = `${id}/album/${sanitizeFileName(img.originalname)}`;
          const { error: imgError } = await supabaseClient
            .storage
            .from('events')
            .upload(filePath, img.buffer, {
              contentType: img.mimetype,
              upsert: true,
            });
          if (imgError) {
            console.error('Image upload error:', imgError);
            return { success: false, message: `Failed to upload new image: ${img.originalname}` };
          }
        }
      }

      // Re-fetch the updated event with new signed URLs
      const updatedEvent = await this.getEventById(id);
      return { success: true, data: updatedEvent.data, message: 'Event updated successfully' };

    } catch (error) {
      console.error('Unexpected error updating event:', error);
      return { success: false, message: 'Unexpected error occurred' };
    }
  },


  async deleteEvent(id) {
    try {
      // 1. Delete files in storage
      const coverPath = `${id}/cover`;
      const albumPath = `${id}/album`;

      // Delete cover file(s)
      const { data: coverFiles, error: coverListError } = await supabaseClient
        .storage
        .from('events')
        .list(coverPath);

      if (!coverListError && coverFiles.length > 0) {
        const coverPaths = coverFiles.map(f => `${coverPath}/${f.name}`);
        await supabaseClient.storage.from('events').remove(coverPaths);
      }

      // Delete album files
      const { data: albumFiles, error: albumListError } = await supabaseClient
        .storage
        .from('events')
        .list(albumPath);

      if (!albumListError && albumFiles.length > 0) {
        const albumPaths = albumFiles.map(f => `${albumPath}/${f.name}`);
        await supabaseClient.storage.from('events').remove(albumPaths);
      }

      // 2. Delete the event row from DB
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);

      return { success: true, data, message: 'Event and its files deleted successfully' };
    } catch (error) {
      console.error('Unexpected error deleting event:', error);
      return { success: false, message: 'Unexpected error occurred' };
    }
  },

  async deleteImageByUrl(imageUrl) {
    try {
      // Supabase public URL pattern:
      // https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<file-path>
      const url = new URL(imageUrl);
      const parts = url.pathname.split('/'); // splits by '/'

      // Find 'public' segment index
      const publicIndex = parts.indexOf('public');
      if (publicIndex === -1 || parts.length <= publicIndex + 2) {
        throw new Error('Invalid Supabase public URL');
      }

      const bucketName = parts[publicIndex + 1];
      const filePath = parts.slice(publicIndex + 2).join('/');

      const { data, error } = await supabaseClient
        .storage
        .from(bucketName)
        .remove([filePath]);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data };
    } catch (err) {
      console.error('Unexpected error deleting image:', err);
      return { success: false, message: 'Unexpected error occurred' };
    }
  }

};

module.exports = eventsService;

