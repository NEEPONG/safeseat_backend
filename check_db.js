const { supabase } = require('./src/config/supabase');

async function testSelect() {
  const { data, error } = await supabase.from('requestbyuser').select('*').limit(1);
  if (error) {
    console.error("Error querying requestbyuser:", error);
  } else {
    console.log("requestbyuser sample data:", data);
  }
}

testSelect();
