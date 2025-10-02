const { supabaseClient } = require('../lib/supabase');

const TABLE_NAME = 'news';

async function getPublicUrl(bucket, path) {
    return `https://qibcyzjbgwgijkrtkzap.supabase.co/storage/v1/object/public/${bucket}/${path}`;
}

const newsService = {

    async getAllNews() {
        try {
            const { data, error } = await supabaseClient.from(TABLE_NAME)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) return { success: false, message: error.message };

            const enriched = await Promise.all(data.map(async item => {
                // List images
                const { data: images } = await supabaseClient.storage.from('news').list(`${item.id}/images`);
                const imageUrls = await Promise.all(images?.map(async (f) => await getPublicUrl('news', `${item.id}/images/${f.name}`)) || []);

                // List files
                const { data: files } = await supabaseClient.storage.from('news').list(`${item.id}/files`);
                const fileUrls = await Promise.all(files?.map(async(f) => await getPublicUrl('news', `${item.id}/files/${f.name}`)) || []);

                console.log("image urls", imageUrls)
                return { ...item, images: imageUrls, files: fileUrls };
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

            const { data: images } = await supabaseClient.storage.from('news').list(`${id}/images`);
            const imageUrls = await Promise.all (images?.map(async (f) => await  getPublicUrl('news', `${id}/images/${f.name}`)) || [])

            const { data: files } = await supabaseClient.storage.from('news').list(`${id}/files`);
            const fileUrls = await Promise.all (files?.map(async (f) => await getPublicUrl('news', `${id}/files/${f.name}`)) || [])

            return { success: true, data: { ...data, images: imageUrls, files: fileUrls } };
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

            // Upload images
            if (files.images) {
                for (const img of files.images) {
                    const path = `${newsId}/images/${sanitize(img.originalname)}`;
                    await supabaseClient.storage.from('news').upload(path, img.buffer, { contentType: img.mimetype, upsert: true });
                }
            }

            // Upload files
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

            // Upload new images
            if (files.images) {
                for (const img of files.images) {
                    const path = `${id}/images/${sanitize(img.originalname)}`;
                    await supabaseClient.storage.from('news').upload(path, img.buffer, { contentType: img.mimetype, upsert: true });
                }
            }

            // Upload new files
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
            // Delete all images
            const { data: images } = await supabaseClient.storage.from('news').list(`${id}/images`);
            if (images?.length > 0) await supabaseClient.storage.from('news').remove(images.map(f => `${id}/images/${f.name}`));

            // Delete all files
            const { data: files } = await supabaseClient.storage.from('news').list(`${id}/files`);
            if (files?.length > 0) await supabaseClient.storage.from('news').remove(files.map(f => `${id}/files/${f.name}`));

            // Delete DB row
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

