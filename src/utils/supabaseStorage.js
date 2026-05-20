const fs = require('fs');
const path = require('path');
const { supabase } = require('../config/supabase');

/**
 * Uploads a file to Supabase Storage and returns its public URL.
 * Automatically deletes the local temporary file after uploading to keep disk clean.
 * 
 * @param {Object} file - Multer file object
 * @param {string} bucketName - Name of the Supabase Storage bucket
 * @param {string} folderName - Subfolder inside the bucket (e.g. 'drivers', 'pubs')
 * @returns {Promise<string>} Public URL of the uploaded file
 */
const uploadToSupabase = async (file, bucketName = 'images', folderName = 'uploads') => {
  if (!file) return null;

  try {
    const fileBuffer = fs.readFileSync(file.path);
    const fileExtension = path.extname(file.originalname);
    // Create a unique filename using timestamp and a random string
    const uniqueFileName = `${folderName}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}${fileExtension}`;

    // Upload the file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(uniqueFileName, fileBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      throw new Error(`ไม่สามารถอัปโหลดไฟล์ไปยัง Supabase Storage: ${error.message}`);
    }

    // Get the public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(uniqueFileName);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error('ไม่สามารถดึง Public URL จาก Supabase Storage ได้');
    }

    // Delete the temporary file from the local filesystem
    try {
      fs.unlinkSync(file.path);
    } catch (unlinkErr) {
      console.warn(`Warning: Failed to delete local temp file at ${file.path}:`, unlinkErr);
    }

    return publicUrlData.publicUrl;

  } catch (err) {
    // Ensure the local file is cleaned up even if the upload fails
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (unlinkErr) {
      console.warn(`Warning: Failed to delete local temp file at ${file.path} on error:`, unlinkErr);
    }
    throw err;
  }
};

/**
 * Strips the Supabase Storage public prefix to get the relative path.
 */
const getRelativePath = (url) => {
  if (!url) return '';
  const marker = '/public/images/';
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return url.substring(idx + marker.length);
  }
  return url;
};

/**
 * Prepends the Supabase URL to get the full public storage URL.
 */
const getFullStorageUrl = (relativePath) => {
  if (!relativePath) return '';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const baseUrl = process.env.SUPABASE_URL || 'https://qbionbozkvlekpakvstg.supabase.co';
  return `${baseUrl}/storage/v1/object/public/images/${relativePath}`.replace(/([^:]\/)\/+/g, "$1");
};

/**
 * Formats a driver object's regisimagepath field by converting relative paths back to full URLs.
 */
const formatDriverDocs = (driver) => {
  if (!driver || !driver.regisimagepath) return driver;
  try {
    const docs = JSON.parse(driver.regisimagepath);
    if (docs && typeof docs === 'object') {
      const formattedDocs = {};
      for (const [key, val] of Object.entries(docs)) {
        formattedDocs[key] = getFullStorageUrl(val);
      }
      driver.regisimagepath = JSON.stringify(formattedDocs);
    }
  } catch (e) {
    // If not a JSON string, try converting it as a single relative path
    driver.regisimagepath = getFullStorageUrl(driver.regisimagepath);
  }
  return driver;
};

module.exports = {
  uploadToSupabase,
  getRelativePath,
  getFullStorageUrl,
  formatDriverDocs
};

