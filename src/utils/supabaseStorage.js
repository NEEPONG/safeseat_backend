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
    // Create a unique filename using timestamp and a random string (shortened to save database space)
    const uniqueFileName = `${folderName}/${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}${fileExtension}`;

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
 * Compresses a relative path to save database space.
 * "drivers/profile/filename.ext" -> "p:filename.ext"
 * "drivers/documents/filename.ext" -> "d:filename.ext"
 */
const compressPath = (relativePath) => {
  if (!relativePath) return '';
  if (relativePath.startsWith('drivers/profile/')) {
    return 'p:' + relativePath.substring('drivers/profile/'.length);
  }
  if (relativePath.startsWith('drivers/documents/')) {
    return 'd:' + relativePath.substring('drivers/documents/'.length);
  }
  return relativePath;
};

/**
 * Decompresses a compressed path back to relative path.
 * "p:filename.ext" -> "drivers/profile/filename.ext"
 * "d:filename.ext" -> "drivers/documents/filename.ext"
 */
const decompressPath = (compressedPath) => {
  if (!compressedPath) return '';
  if (compressedPath.startsWith('p:')) {
    return 'drivers/profile/' + compressedPath.substring(2);
  }
  if (compressedPath.startsWith('d:')) {
    return 'drivers/documents/' + compressedPath.substring(2);
  }
  return compressedPath;
};

/**
 * Prepends the Supabase URL to get the full public storage URL.
 */
const getFullStorageUrl = (relativePath) => {
  if (!relativePath) return '';
  const decompressed = decompressPath(relativePath);
  if (decompressed.startsWith('http://') || decompressed.startsWith('https://')) {
    return decompressed;
  }
  const baseUrl = process.env.SUPABASE_URL || 'https://qbionbozkvlekpakvstg.supabase.co';
  return `${baseUrl}/storage/v1/object/public/images/${decompressed}`.replace(/([^:]\/)\/+/g, "$1");
};

const formatDriverDocs = (driver) => {
  if (!driver || !driver.regisimagepath) return driver;
  try {
    const docs = JSON.parse(driver.regisimagepath);
    if (Array.isArray(docs)) {
      // Compressed array format: map to the full JSON object expected by frontend
      const formattedDocs = {
        profile: getFullStorageUrl(docs[0]),
        driverLicense: getFullStorageUrl(docs[1]),
        criminalRecord: getFullStorageUrl(docs[2]),
        medicalCertificate: getFullStorageUrl(docs[3]),
        trainingCert1: getFullStorageUrl(docs[4]),
        trainingCert2: getFullStorageUrl(docs[5]),
        trainingCert3: getFullStorageUrl(docs[6]),
        trainingCert4: getFullStorageUrl(docs[7])
      };
      driver.regisimagepath = JSON.stringify(formattedDocs);
    } else if (docs && typeof docs === 'object') {
      // Legacy JSON object format
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
  formatDriverDocs,
  compressPath,
  decompressPath
};

