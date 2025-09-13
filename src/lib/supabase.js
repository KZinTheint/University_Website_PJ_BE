const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;


const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = {
 supabaseClient  
}
