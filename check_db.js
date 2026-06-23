const { supabase } = require('./src/config/supabase');

async function testSelect() {
  const { data, error } = await supabase.from('requestbyuser').select('*').limit(1);
  console.log("requestbyuser sample:", data, error);
}

testSelect();
