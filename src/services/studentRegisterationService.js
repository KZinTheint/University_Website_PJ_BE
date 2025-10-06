// This is the service layer. In a larger application, this would contain
// the business logic, database queries, or external API calls.
// For this simple example, it just returns a string.

const { supabaseClient } = require('../lib/supabase')

const RegisterationService = {

  async getAllRegisetrationData() {
    // 1. Get all registration data from the database
    const { data, error } = await supabaseClient.from("StudentRegisteration").select("*");
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    // 2. Map over the data to fetch files for each registration

    const registrationsWithFiles = await Promise.all(
      data.map(async (registration) => {
        const uuidFolderName = registration.id;

        if (uuidFolderName) {
          const { data: fileList, error: listError } = await supabaseClient
            .storage
            .from("student-documents")
            .list(uuidFolderName);

          if (listError) {
            console.error(`Error listing files for folder ${uuidFolderName}:`, listError);
            return { ...registration, files: [] };
          }

          // Only include file names, no public URLs
          const files = fileList.map(file => ({
            name: file.name
          }));

          return {
            ...registration,
            files
          };
        }

        return { ...registration, files: [] };
      })
    );

    return {
      success: true,
      data: registrationsWithFiles
    };
  },
  // A private helper function for the service
  async uploadFile(bucket, folderId, file, fileName) {
    const filePath = `${folderId}/${fileName}`;
    const { error } = await supabaseClient.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error(`Supabase file upload error for ${fileName}:`, error);
      return { success: false, error };
    }
    return { success: true };
  },


async addRegistration(data, files) {
  let studentId = null;
  try {
    // 1️⃣ Check if user with same national ID exists
    const { data: existingUsers, error: selectError } = await supabaseClient
      .from('StudentRegisteration')
      .select('id')
      .eq('national_id_prefix', data['national-id-prefix'])
      .eq('national_id_region', data['national-id-region'])
      .eq('citizen_type', data['citizen-type'])
      .eq('national_id_number', data['national-id-number'])
      .limit(1);

    if (selectError) {
      console.error('Supabase select error:', selectError);
      return { success: false, message: selectError.message };
    }

    if (existingUsers && existingUsers.length > 0) {
      return { success: false, message: 'User with this national ID already exists.' };
    }

    // 2️⃣ Generate form_id
    const currentYear = new Date().getFullYear();
    const { data: latestRegistration, error: latestError } = await supabaseClient
      .from('StudentRegisteration')
      .select('form_id')
      .like('form_id', `${currentYear}-%`)
      .order('form_id', { ascending: false })
      .limit(1);

    if (latestError) {
      console.error('Supabase select error:', latestError);
      return { success: false, message: latestError.message };
    }

    let newCounter = 1;
    if (latestRegistration && latestRegistration.length > 0) {
      const lastFormId = latestRegistration[0].form_id;
      if (lastFormId) {
        const lastYear = parseInt(lastFormId.split('-')[0]);
        if (lastYear === currentYear) {
          newCounter = parseInt(lastFormId.split('-')[1]) + 1;
        }
      }
    }

    const formId = `${currentYear}-${String(newCounter).padStart(4, '0')}`;

    // 3️⃣ Insert new registration record
    const { data: newRow, error: insertError } = await supabaseClient
      .from('StudentRegisteration')
      .insert([
        {
          form_id: formId,
          first_name: data['first-name'],
          last_name: data['last-name'],
          date_of_birth: data['dob'],
          gender: data['gender'],
          nationality: data['nationality'],
          national_id_prefix: data['national-id-prefix'],
          national_id_region: data['national-id-region'],
          citizen_type: data['citizen-type'],
          national_id_number: data['national-id-number'],
          email: data['email'],
          phone_number: data['phone-number'],
          permanent_address: data['permanent-address'],
          city: data['city'],
          state_region: data['state-region'],
          high_school_name: data['high-school-name'],
          high_school_marks: parseInt(data['high-school-marks']),
          desired_program: data['desired-program'],
          emergency_contact_name: data['emergency-contact-name'],
          emergency_contact_phone: data['emergency-contact-phone'],
          emergency_contact_relationship: data['emergency-contact-relationship'],
        },
      ])
      .select('id')
      .single();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return { success: false, message: insertError.message };
    }

    studentId = newRow.id;

    // 4️⃣ Upload files
    const requiredFiles = [
      'high-school-certificate',
      'grade-12-marks-results',
      'national-id-card',
      'birth-certificate',
      'passport-photo',
    ];

    const uploadedFiles = [];

    for (const fileKey of requiredFiles) {
      const file = files[fileKey][0];
      const uploadResult = await this.uploadFile('student-documents', studentId, file, fileKey);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error?.message || `Failed to upload file: ${fileKey}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabaseClient
        .storage
        .from('student-documents')
        .getPublicUrl(`${studentId}/${fileKey}`);

      uploadedFiles.push({
        name: file.name,
        type: fileKey,
        url: publicUrlData.publicUrl,
      });
    }

    // 5️⃣ Return full data
    return {
      success: true,
      message: 'Registration and file uploads saved successfully',
      data: {
        ...data,
        id: studentId,
        form_id: formId,
        files: uploadedFiles,
      },
    };

  } catch (err) {
    if (studentId) {
      await supabaseClient.from('StudentRegisteration').delete().eq('id', studentId);
      console.error('Cleaned up partially created registration due to file upload failure.');
    }
    console.error('Unexpected error inserting registration:', err.message);
    return { success: false, message: 'An unexpected error occurred during registration.' };
  }
},

  async deleteRegistrations(ids) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, message: 'No IDs provided for deletion.' };
      }

      // 1. Delete files for each registration ID
      for (const id of ids) {
        // List all files in the folder for this registration
        const { data: fileList, error: listError } = await supabaseClient
          .storage
          .from('student-documents')
          .list(String(id));

        if (listError) {
          console.error(`Error listing files for registration ${id}:`, listError);
          // continue deleting other registrations even if listing fails
        } else if (fileList && fileList.length > 0) {
          const filePaths = fileList.map(f => `${id}/${f.name}`);
          const { error: deleteFilesError } = await supabaseClient
            .storage
            .from('student-documents')
            .remove(filePaths);

          if (deleteFilesError) {
            console.error(`Error deleting files for registration ${id}:`, deleteFilesError);
          }
        }
      }

      // 2. Delete registrations from the table
      const { error: deleteRowsError } = await supabaseClient
        .from('StudentRegisteration')
        .delete()
        .in('id', ids);

      if (deleteRowsError) {
        console.error('Error deleting registrations:', deleteRowsError);
        return { success: false, message: deleteRowsError.message };
      }

      return { success: true, message: `Successfully deleted ${ids.length} registrations.` };

    } catch (err) {
      console.error('Unexpected error during deletion:', err.message);
      return { success: false, message: 'An unexpected error occurred during deletion.' };
    }
  },

  async getSignedUrls(registrationId, fileName, expiresIn = 300) {
    try {
      const filePath = `${registrationId}/${fileName}`;

      console.log(filePath)
      // Generate a signed URL for the specific file
      const { data, error } = await supabaseClient
        .storage
        .from('student-documents')
        .createSignedUrl(filePath, expiresIn); // expiresIn in seconds

      console.log(data)

      if (error) {
        console.error(`Error generating signed URL for ${filePath}:`, error);
        return { success: false, message: error.message };
      }

      return { success: true, file: { name: fileName, url: data.signedUrl } };

    } catch (err) {
      console.error('Unexpected error generating signed URL:', err.message);
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }
}

module.exports = RegisterationService
