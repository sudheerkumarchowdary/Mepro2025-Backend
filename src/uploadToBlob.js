const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require('@azure/storage-blob');
require('dotenv').config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_CONTAINER_NAME;

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);

// Function to generate SAS token for a blob
const generateSASUrl = (fileName) => {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  // Generate a SAS token (valid for 1 year)
  const expiresOn = new Date();
  expiresOn.setFullYear(expiresOn.getFullYear() + 1); // 1 year from now
  
  const startsOn = new Date();
  startsOn.setMinutes(startsOn.getMinutes() - 5); // Allow 5 minutes clock skew

  const sasToken = generateBlobSASQueryParameters({
    containerName,
    blobName: fileName,
    startsOn,
    expiresOn,
    permissions: BlobSASPermissions.parse("r"),
  }, sharedKeyCredential).toString();

  // Return the URL with SAS token
  return `${blockBlobClient.url}?${sasToken}`;
};

// Function to detect content type from file extension
const getContentType = (fileName) => {
  const ext = fileName.toLowerCase().split('.').pop();
  const contentTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'txt': 'text/plain',
    'html': 'text/html',
  };
  return contentTypes[ext] || 'application/octet-stream';
};

const uploadToBlob = async (fileBuffer, fileName) => {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  // Detect content type from file extension
  const contentType = getContentType(fileName);

  // Upload file with proper content type
  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: { 
      blobContentType: contentType,
      blobContentDisposition: `inline; filename="${fileName}"`
    },
  });

  // Generate a fresh SAS URL
  return generateSASUrl(fileName);
};

// Export both functions
module.exports = { uploadToBlob, generateSASUrl };
