const AdminController = require('./src/controllers/admin/adminController');
const { supabase } = require('./src/config/supabase');

async function verifyBackendCode() {
  console.log("Verifying backend Admin controller logic...");
  try {
    // Mock req and res objects
    const req = {
      body: {
        username: 'safeseat2026',
        password: 'safeseat_01'
      }
    };
    
    let responseStatus = 200;
    let responseJson = null;
    
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseJson = data;
        return this;
      }
    };
    
    // Call controller login method
    await AdminController.login(req, res);
    
    console.log("Verification results:");
    console.log("Response status code:", responseStatus);
    console.log("Response JSON:", responseJson);
    
    if (responseStatus === 200 && responseJson && responseJson.success) {
      console.log("SUCCESS: AdminController login compiled and executed successfully! Admin successfully verified.");
    } else {
      console.error("FAILURE: AdminController login failed verification.", responseStatus, responseJson);
    }
  } catch (err) {
    console.error("EXCEPTION during verification:", err);
  }
}

verifyBackendCode();
