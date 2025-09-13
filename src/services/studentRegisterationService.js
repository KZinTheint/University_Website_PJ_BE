// This is the service layer. In a larger application, this would contain
// the business logic, database queries, or external API calls.
// For this simple example, it just returns a string.

const { supabaseClient } = require('../lib/supabase')

const RegisterationService = {

  async getAllRegisetrationData() {
    const { data, error } = await supabaseClient.from("StudentRegisteration").select("*");
    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
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
      // Check if a user with same national ID exists
      const { data: existingUsers, error: selectError } = await supabaseClient
        .from('StudentRegisteration')
        .select('id')
        .eq('national_id_prefix', data['national-id-prefix'])
        .eq('national_id_number', data['national-id-number'])
        .limit(1);

      if (selectError) {
        console.error('Supabase select error:', selectError);
        return { success: false, message: selectError.message }; // Return message instead of error object
      }

      // Insert new registration
      if (existingUsers && existingUsers.length > 0) {
        return { success: false, message: 'User with this national ID already exists.' };
      }

      const { data: newRow, error: insertError } = await supabaseClient
        .from('StudentRegisteration')
        .insert([
          {

            first_name: data['first-name'],
            last_name: data['last-name'],
            date_of_birth: data['dob'],
            gender: data['gender'],
            nationality: data['nationality'],
            national_id_prefix: data['national-id-prefix'],
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
          }

        ])
        .select('id')
        .single();

      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return { success: false, message: insertError.message }; // Return message instead of error object
      }

      studentId = newRow.id;

      const requiredFiles = [
        'high-school-certificate',
        'grade-12-marks-results',
        'national-id-card',
        'birth-certificate',
        'passport-photo'
      ];

      for (const fileKey of requiredFiles) {
        const file = files[fileKey][0];
        const uploadResult = await this.uploadFile('student-documents', studentId, file, fileKey);

        if (!uploadResult.success) {
          throw new Error(uploadResult.error.message || `Failed to upload file: ${fileKey}`);
        }
      }

      return { success: true, message: 'Registration and file uploads saved successfully' };

    } catch (err) {
      if (studentId) {
        await supabaseClient.from('StudentRegisteration').delete().eq('id', studentId);
        console.error('Cleaned up partially created registration due to file upload failure.');
      }
      console.error('Unexpected error inserting registration:', err.message);
      return { success: false, message: 'An unexpected error occurred during registration.' };
    }
  }
}

module.exports = RegisterationService 
