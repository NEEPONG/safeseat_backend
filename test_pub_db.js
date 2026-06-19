const { supabase } = require('./src/config/supabase');

async function checkBuddyTeams() {
  const { data, error } = await supabase.from('buddyteam').select('*');
  if (error) {
    console.error("Error fetching buddyteam:", error);
  } else {
    console.log("Buddy teams in DB:", data);
  }
}

checkBuddyTeams();
