import { api } from './api';
import { Platform } from 'react-native';
import { getApiUrl } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

/**
 * Check if user is logged in
 * @returns {Promise<boolean>} - True if logged in
 */
const isUserLoggedIn = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    return !!token;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return false;
  }
};

/**
 * Get an API client that doesn't automatically add auth headers
 * @returns {Object} - Axios instance without auth
 */
const getAnonymousApiClient = () => {
  return axios.create({
    baseURL: getApiUrl(),
  });
};

/**
 * Convert image URI to FormData for API upload
 */
const uriToFormData = (uri, fieldName, fileName = 'image.jpg') => {
  if (!uri) return null;
  
  console.log(`Converting URI to FormData: ${uri.substring(0, 30)}...`);
  
  // Extract file name from URI if possible
  let actualFileName = fileName;
  try {
    const uriParts = uri.split('/');
    const nameWithParams = uriParts[uriParts.length - 1];
    actualFileName = nameWithParams.split('?')[0]; // Remove query params if present
    
    // Add extension if missing
    if (!actualFileName.includes('.')) {
      actualFileName += '.jpg';
    }
  } catch (e) {
    console.log(`Error extracting filename from URI: ${e.message}`);
    // Continue with default filename
  }
  
  // Determine mime type based on extension
  let mimeType = 'image/jpeg'; // Default
  if (actualFileName.endsWith('.png')) {
    mimeType = 'image/png';
  } else if (actualFileName.endsWith('.gif')) {
    mimeType = 'image/gif';
  }
  
  console.log(`File name: ${actualFileName}, MIME type: ${mimeType}`);
  
  // Return the file object for form data
  return {
    uri: uri,
    name: actualFileName,
    type: mimeType,
  };
};

/**
 * Optimize image for upload - resizes and compresses to reduce transfer time
 * @param {string} uri - Image URI
 * @returns {Promise<string>} - Optimized image URI
 */
const optimizeImage = async (uri) => {
  try {
    console.log(`Optimizing image: ${uri.substring(0, 30)}...`);
    const start = Date.now();
    
    // Process image - resize to max 1080px width/height, compress to 80% quality
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1080, height: 1080 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    const duration = Date.now() - start;
    console.log(`Image optimized in ${duration}ms. Original: ${uri.length}, Optimized: ${result.uri.length}`);
    
    return result.uri;
  } catch (e) {
    console.error('Error optimizing image:', e);
    // Return original if optimization fails
    return uri;
  }
};

/**
 * Upload an image to Cloudinary directly from the frontend
 * @param {string} imageUri - Local image URI to upload
 * @param {string} type - Type of image (model or garment)
 * @returns {Promise<string>} - Cloudinary URL
 */
export const uploadToCloudinary = async (imageUri, type = 'model') => {
  try {
    console.log(`Uploading ${type} image to Cloudinary: ${imageUri.substring(0, 30)}...`);
    
    // First, optimize the image if it's a local file
    const isLocalFile = imageUri.startsWith('file://') || imageUri.startsWith('content://');
    let optimizedUri = imageUri;
    
    if (isLocalFile) {
      try {
        // Optimize the image to reduce upload size
        optimizedUri = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 1080 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
        ).then(result => result.uri);
        
        console.log(`Optimized ${type} image for upload`);
      } catch (error) {
        console.error(`Error optimizing ${type} image:`, error);
        throw new Error(`Failed to process ${type} image. Please try a different image.`);
      }
    }
    
    // If it's a remote URL, just return it
    if (!isLocalFile) {
      console.log(`Image is already a remote URL, skipping Cloudinary upload`);
      return imageUri;
    }
    
    // Prepare the image file for upload
    const formData = new FormData();
    
    // Convert local URI to file object
    const fileName = `${type}_${Date.now()}.jpg`;
    const file = {
      uri: optimizedUri,
      type: 'image/jpeg',
      name: fileName
    };
    
    // Cloudinary unsigned upload preset - you need to create this in your Cloudinary dashboard
    // with proper permissions for your upload folder
    const uploadPreset = type === 'model' ? 'velra_models' : 'velra_garments';
    const cloudName = 'velra';  // Your cloud name from .env
    
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'temp_tryon');
    
    // Upload to Cloudinary
    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`Cloudinary upload failed: ${errorText}`);
      throw new Error('Image upload failed. Please try again.');
    }
    
    const uploadResult = await uploadResponse.json();
    console.log(`Successfully uploaded ${type} image to Cloudinary: ${uploadResult.secure_url}`);
    
    return uploadResult.secure_url;
  } catch (error) {
    console.error(`Error uploading ${type} image to Cloudinary:`, error);
    throw new Error(`Failed to upload ${type} image: ${error.message}`);
  }
};

/**
 * Start a virtual try-on process with model and garment images
 * @param {string} modelImageUri - URI of the model image (selfie)
 * @param {string} garmentImageUri - URI of the garment image
 * @param {object} options - Additional options for the try-on
 * @returns {Promise<object>} - The response with try-on ID and status
 */
export const startVirtualTryOn = async (modelImageUri, garmentImageUri, options = {}) => {
  try {
    console.log('Starting virtual try-on with:');
    console.log('- Model image:', modelImageUri ? `${modelImageUri.substring(0, 30)}...` : 'undefined');
    console.log('- Garment image:', garmentImageUri ? `${garmentImageUri.substring(0, 30)}...` : 'undefined');

    // Validate that both images exist
    if (!modelImageUri) {
      console.error('Model image URI is missing');
      throw new Error('Model image is required');
    }
    
    if (!garmentImageUri) {
      console.error('Garment image URI is missing');
      throw new Error('Garment image is required');
    }

    // Explicitly get the auth token
    const authToken = await AsyncStorage.getItem('token');
    if (!authToken) {
      console.warn('No authentication token found in AsyncStorage');
      throw new Error('Please log in to use the try-on feature.');
    }
    console.log('Auth token retrieved:', authToken ? `${authToken.substring(0, 10)}...` : 'null');

    // Determine if images are local files or web URLs
    const isLocalFile = (uri) => uri.startsWith('file://') || uri.startsWith('content://');
    const isModelLocal = isLocalFile(modelImageUri);
    const isGarmentLocal = isLocalFile(garmentImageUri);
    
    // Always optimize local images to ensure proper format
    let optimizedModelUri = modelImageUri;
    let optimizedGarmentUri = garmentImageUri;
    
    if (isModelLocal) {
      try {
        // For local files, ensure they're in JPEG format with reasonable size
        optimizedModelUri = await ImageManipulator.manipulateAsync(
          modelImageUri,
          [{ resize: { width: 1080 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 }
        ).then(result => result.uri);
        
        console.log('Model image optimized to JPEG format');
      } catch (error) {
        console.error('Error optimizing model image:', error);
        throw new Error('Failed to process model image. Please try a different image.');
      }
    }

    if (isGarmentLocal) {
      try {
        // For garment, we'll use slightly higher quality
        optimizedGarmentUri = await ImageManipulator.manipulateAsync(
          garmentImageUri,
          [{ resize: { width: 1080 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
        ).then(result => result.uri);
        
        console.log('Garment image optimized to JPEG format');
      } catch (error) {
        console.error('Error optimizing garment image:', error);
        throw new Error('Failed to process garment image. Please try a different image.');
      }
    }

    // Create FormData for the API request
    const formData = new FormData();
    
    // Add the actual files for model and garment
    if (isModelLocal) {
      const modelFile = {
        uri: optimizedModelUri,
        type: 'image/jpeg',
        name: 'model.jpg'
      };
      formData.append('model_image', modelFile);
    } else {
      // For remote URLs, the backend expects a file, not a URL string
      throw new Error('Remote model image URLs are not supported. Please select a local image.');
    }
    
    if (isGarmentLocal) {
      const garmentFile = {
        uri: optimizedGarmentUri,
        type: 'image/jpeg',
        name: 'garment.jpg'
      };
      formData.append('garment_image', garmentFile);
    } else {
      // For remote URLs, the backend expects a file, not a URL string
      throw new Error('Remote garment image URLs are not supported. Please select a local image.');
    }
    
    // Add other options as form fields
    formData.append('category', options.category || 'auto');
    formData.append('mode', options.mode || 'balanced');
    formData.append('moderation_level', 'permissive');
    formData.append('cover_feet', options.coverFeet ? 'true' : 'false');
    formData.append('adjust_hands', options.adjustHands !== false ? 'true' : 'false');
    
    console.log('Form data prepared for API call');
    
    // Now make the API request with the form data
    console.log('Making try-on request with form data...');
    
    // Set a longer timeout for this request since it involves file uploads
    const response = await api.post('/api/virtual-tryon/try-async', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 60000, // 60 seconds timeout
    });
    
    // Check for error in response even if status is 200
    if (response.data && response.data.error) {
      console.error('API returned an error:', response.data.error);
      throw new Error(response.data.error);
    }
    
    console.log('Try-on request successful:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Try-on Error:', {
      errorDetails: error.response?.data || { detail: error.message },
      requestData: {
        model: modelImageUri,
        garment: garmentImageUri,
        options
      }
    });
    
    // Provide more user-friendly error messages based on error type
    let errorMessage = 'Error processing images';
    
    // Handle different error scenarios
    if (error.response) {
      // Server returned an error response
      const serverError = error.response.data?.detail || error.response.data?.error || 'Unknown server error';
      
      if (error.response.status === 422) {
        errorMessage = `Invalid image format: ${serverError}`;
      } else if (error.response.status === 403) {
        errorMessage = 'You have reached your daily try-on limit. Please upgrade to continue.';
      } else if (error.response.status === 401) {
        errorMessage = 'Please log in to use the try-on feature.';
      } else if (error.response.status === 500) {
        if (typeof serverError === 'string' && (
          serverError.includes('image') || 
          serverError.includes('format') || 
          serverError.includes('file://')
        )) {
          errorMessage = `Image processing error: ${serverError}`;
        } else {
          errorMessage = `Server error: ${serverError}`;
        }
      } else {
        errorMessage = `Error: ${serverError}`;
      }
    } else if (error.message) {
      // Client-side error
      errorMessage = error.message;
    }
    
    // Log the friendly error message we're going to show
    console.log('Showing user-friendly error:', errorMessage);
    
    throw new Error(errorMessage);
  }
};

/**
 * Check the status of a try-on prediction
 * @param {string} predictionId - ID of the try-on prediction
 * @returns {Promise<object>} - Status and result of the try-on
 */
export const checkTryOnStatus = async (predictionId) => {
  try {
    console.log(`Checking status for prediction ID: ${predictionId}`);
    const response = await api.get(`/api/virtual-tryon/status/${predictionId}`);
    console.log(`Status response:`, response.data);
    
    // Process result_url if it's an array - take the first item
    if (response.data && response.data.result_url && Array.isArray(response.data.result_url)) {
      console.log(`Result URL is an array with ${response.data.result_url.length} items`);
      response.data.result_url = response.data.result_url[0]; // Use first image 
    }
    
    return response.data;
  } catch (error) {
    console.error('Error checking try-on status:', {
      predictionId,
      error: error.response?.data || error.message
    });
    
    // Provide a more user-friendly error message
    if (error.response?.status === 404) {
      throw new Error('Try-on prediction not found. It may have expired or been deleted.');
    } else if (error.response?.status === 401) {
      throw new Error('Please log in to check try-on status.');
    } else {
      throw new Error(`Failed to check try-on status: ${error.response?.data?.detail || error.message}`);
    }
  }
};

/**
 * Poll the try-on status until it completes or fails
 * @param {string} predictionId - ID of the try-on prediction
 * @param {function} onStatusUpdate - Callback for status updates
 * @param {number} interval - Polling interval in ms
 * @param {number} timeout - Maximum time to poll in ms
 * @returns {Promise<object>} - Final status and result
 */
export const pollTryOnStatus = async (
  predictionId, 
  onStatusUpdate = () => {}, 
  interval = 2000, 
  timeout = 120000
) => {
  try {
    const startTime = Date.now();
    let lastError = null;
    let errorCount = 0;
    
    while (Date.now() - startTime < timeout) {
      try {
        const status = await checkTryOnStatus(predictionId);
        
        // Process result_url if it's an array
        if (status && status.result_url && Array.isArray(status.result_url)) {
          console.log(`Result URL in polling is an array with ${status.result_url.length} items`);
          status.result_url = status.result_url[0]; // Use first image
        }
        
        onStatusUpdate(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          return status;
        }
        
        // Reset error counter on successful request
        errorCount = 0;
        lastError = null;
      } catch (error) {
        console.error(`Error polling try-on status (attempt ${errorCount + 1}):`, error);
        errorCount++;
        lastError = error;
        
        // If we've had 3 consecutive errors, throw the last error
        if (errorCount >= 3) {
          throw new Error(`Multiple polling errors: ${lastError.message}`);
        }
      }
      
      // Wait for the specified interval
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Try-on process timed out');
  } catch (error) {
    console.error('Error during try-on polling:', error);
    onStatusUpdate({
      id: predictionId,
      status: 'failed',
      error: error.message || 'Error checking try-on status'
    });
    throw error;
  }
};

/**
 * Get the user's virtual try-on usage statistics
 * @returns {Promise<object>} - Usage statistics including daily and monthly counts and limits
 */
export const getTryOnUsage = async () => {
  try {
    console.log('Fetching try-on usage statistics');
    
    // Get the authentication token
    const authToken = await AsyncStorage.getItem('token');
    if (!authToken) {
      throw new Error('Authentication required');
    }
    
    // Call the API to get usage statistics
    // The backend automatically handles:
    // - Daily limit reset at midnight
    // - Monthly limit reset at the end of each month
    const response = await api.get('/api/virtual-tryon/usage', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    console.log('Try-on usage response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error getting try-on usage:', error);
    // Return default values if there's an error
    return {
      daily_count: 0,
      monthly_count: 0, // Track monthly usage (resets at end of month)
      total_count: 0,
      daily_limit: 1,
      monthly_limit: 40 // 40 try-ons per month limit
    };
  }
};

export default {
  startVirtualTryOn,
  checkTryOnStatus,
  pollTryOnStatus,
  getTryOnUsage
};