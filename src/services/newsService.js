const { supabaseClient } = require('../lib/supabase');

const TABLE_NAME = 'news';

async function getSignedUrl(filePath) {
  const { data, error } = await supabaseClient
    .storage
    .from('news')
    .createSignedUrl(filePath, 60 * 60); // valid for 1 hour
  if (error) {
    console.error('Signed URL error:', error.message);
    return null;
  }
  return data.signedUrl;
}

const newsService = {

    async getAllNews() {
        try {
            const { data, error } = await supabaseClient.from(TABLE_NAME)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) return { success: false, message: error.message };

            const enriched = await Promise.all(data.map(async item => {
                const coverPath = `${item.id}/cover`;
                const { data: coverFiles } = await supabaseClient.storage.from('news').list(coverPath);
                const coverUrl = coverFiles?.[0] ? await getSignedUrl(`${coverPath}/${coverFiles[0].name}`) : null;

                const { data: images } = await supabaseClient.storage.from('news').list(`${item.id}/images`);
                const imageUrls = await Promise.all(images?.map(async (f) => await getSignedUrl(`${item.id}/images/${f.name}`)) || []);

                const { data: files } = await supabaseClient.storage.from('news').list(`${item.id}/files`);
                const fileUrls = await Promise.all(files?.map(async(f) => await getSignedUrl(`${item.id}/files/${f.name}`)) || []);

                return { ...item, cover_url: coverUrl, images: imageUrls, files: fileUrls };
            }));

            return { success: true, data: enriched };
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Unexpected error occurred' };
        }
    },

    async getNewsById(id) {
        try {
            const { data, error } = await supabaseClient.from(TABLE_NAME).select('*').eq('id', id).single();
            if (error) return { success: false, message: error.message };

            const coverPath = `${id}/cover`;
            const { data: coverFiles } = await supabaseClient.storage.from('news').list(coverPath);
            const coverUrl = coverFiles?.[0] ? await getSignedUrl(`${coverPath}/${coverFiles[0].name}`) : null;

            const { data: images } = await supabaseClient.storage.from('news').list(`${id}/images`);
            const imageUrls = await Promise.all (images?.map(async (f) => await  getSignedUrl(`${id}/images/${f.name}`)) || [])

            const { data: files } = await supabaseClient.storage.from('news').list(`${id}/files`);
            const fileUrls = await Promise.all (files?.map(async (f) => await getSignedUrl(`${id}/files/${f.name}`)) || [])

            return { success: true, data: { ...data, cover_url: coverUrl, images: imageUrls, files: fileUrls } };
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Unexpected error occurred' };
        }
    },

    async createNews(data, files) {
        try {
            const content = data.content ? JSON.parse(data.content).map(c => ({
                subheading: c.subheading || null,
                description: c.description || null
            })) : null;

            const newsRow = { title: data.title, content };
            const { data: newNews, error } = await supabaseClient.from(TABLE_NAME).insert([newsRow]).select().single();
            if (error) return { success: false, message: error.message };

            const newsId = newNews.id;
            const sanitize = name => name.replace(/[^a-zA-Z0-9-_.]/g, '_');

            if (files.cover_image && files.cover_image[0]) {
                const coverFile = files.cover_image[0];
                const filePath = `${newsId}/cover/${sanitize(coverFile.originalname)}`;
                const { error: coverError } = await supabaseClient.storage.from('news').upload(filePath, coverFile.buffer, { contentType: coverFile.mimetype, upsert: true });
                if (coverError) return { success: false, message: 'Failed to upload cover image' };
            }

            if (files.images) {
                for (const img of files.images) {
                    const path = `${newsId}/images/${sanitize(img.originalname)}`;
                    await supabaseClient.storage.from('news').upload(path, img.buffer, { contentType: img.mimetype, upsert: true });
                }
            }

            if (files.files) {
                for (const f of files.files) {
                    const path = `${newsId}/files/${sanitize(f.originalname)}`;
                    await supabaseClient.storage.from('news').upload(path, f.buffer, { contentType: f.mimetype, upsert: true });
                }
            }

            return { success: true, data: newNews };
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Unexpected error occurred' };
        }
    },

    async updateNews(id, data, files) {
        try {
            const content = data.content ? JSON.parse(data.content).map(c => ({
                subheading: c.subheading || null,
                description: c.description || null
            })) : null;

            const updateData = { title: data.title, content };
            const { data: updated, error } = await supabaseClient.from(TABLE_NAME).update(updateData).eq('id', id).select();
            if (error || !updated) return { success: false };

            const sanitize = name => name.replace(/[^a-zA-Z0-9-_.]/g, '_');

            if (files.cover_image && files.cover_image[0]) {
                const coverFile = files.cover_image[0];
                const coverPath = `${id}/cover`;
                const { data: existingCover } = await supabaseClient.storage.from('news').list(coverPath);
                if (existingCover && existingCover.length > 0) {
                    await supabaseClient.storage.from('news').remove([`${coverPath}/${existingCover[0].name}`]);
                }
                const filePath = `${coverPath}/${sanitize(coverFile.originalname)}`;
                const { error: coverError } = await supabaseClient.storage.from('news').upload(filePath, coverFile.buffer, { contentType: coverFile.mimetype, upsert: true });
                if (coverError) return { success: false, message: 'Failed to upload new cover image' };
            }

            if (files.images) {
                for (const img of files.images) {
                    const path = `${id}/images/${sanitize(img.originalname)}`;
                    await supabaseClient.storage.from('news').upload(path, img.buffer, { contentType: img.mimetype, upsert: true });
                }
            }

            if (files.files) {
                for (const f of files.files) {
                    const path = `${id}/files/${sanitize(f.originalname)}`;
                    await supabaseClient.storage.from('news').upload(path, f.buffer, { contentType: f.mimetype, upsert: true });
                }
            }

            return this.getNewsById(id);
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Unexpected error occurred' };
        }
    },

    async deleteNews(id) {
        try {
            const coverPath = `${id}/cover`;
            const { data: coverFiles } = await supabaseClient.storage.from('news').list(coverPath);
            if (coverFiles && coverFiles.length > 0) {
                const coverPaths = coverFiles.map(f => `${coverPath}/${f.name}`);
                await supabaseClient.storage.from('news').remove(coverPaths);
            }

            const { data: images } = await supabaseClient.storage.from('news').list(`${id}/images`);
            if (images?.length > 0) await supabaseClient.storage.from('news').remove(images.map(f => `${id}/images/${f.name}`));

            const { data: files } = await supabaseClient.storage.from('news').list(`${id}/files`);
            if (files?.length > 0) await supabaseClient.storage.from('news').remove(files.map(f => `${id}/files/${f.name}`));

            await supabaseClient.from(TABLE_NAME).delete().eq('id', id);

            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Unexpected error occurred' };
        }
    },

    async deleteFileByUrl(fileUrl) {
        try {
            const url = new URL(fileUrl);
            const parts = url.pathname.split('/');
            const publicIndex = parts.indexOf('public');
            if (publicIndex === -1) throw new Error('Invalid URL');
            const bucketName = parts[publicIndex + 1];
            const filePath = parts.slice(publicIndex + 2).join('/');
            await supabaseClient.storage.from(bucketName).remove([filePath]);
            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Unexpected error occurred' };
        }
    }
};

module.exports = newsService;

