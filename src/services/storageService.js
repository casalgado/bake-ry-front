import { storage } from '@/config/firebase';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

class StorageService {
  /**
   * Upload an image with progress tracking
   * @param {File} file - The file to upload
   * @param {string} path - Storage path (e.g., 'bakeries/123/logos/')
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Promise<Object>} - Object with originalUrl and resizedUrls
   */
  async uploadImage(file, path, onProgress = () => {}) {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `${path}${fileName}`);

    // Create upload task
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          try {
            // Get the original image URL
            const originalUrl = await getDownloadURL(uploadTask.snapshot.ref);

            // Wait a bit for resizer extension to process
            // Comment out if extension is not installed yet
            // await new Promise(resolve => setTimeout(resolve, 2000));

            // Get resized versions (will be empty if extension not installed)
            const resizedUrls = {}; // await this.getResizedImageUrls(path, fileName);

            resolve({
              originalUrl,
              resizedUrls,
              fileName,
              path,
            });
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }

  /**
   * Get URLs for resized versions of an image
   * @param {string} path - Base storage path
   * @param {string} fileName - Original file name
   * @returns {Promise<Object>} - Object with size keys and URLs
   *
   * Note: Configure Firebase Resize Images extension with:
   * - Sizes: 200x200, 400x400, 800x800
   * - Resize mode: fit (maintains aspect ratio)
   * - Path pattern: {name}_{width}x{height}
   */
  async getResizedImageUrls(path, fileName) {
    const resizedUrls = {};
    const sizes = ['200x200', '400x400', '800x800'];

    // Get filename without extension and the extension separately
    const lastDotIndex = fileName.lastIndexOf('.');
    const nameWithoutExt = fileName.substring(0, lastDotIndex);
    const extension = fileName.substring(lastDotIndex);

    for (const size of sizes) {
      try {
        // Firebase extension pattern: originalname_widthxheight.extension
        const resizedFileName = `${nameWithoutExt}_${size}${extension}`;
        const resizedRef = ref(storage, `${path}${resizedFileName}`);
        const url = await getDownloadURL(resizedRef);
        resizedUrls[size] = url;
      } catch (error) {
        // Resized version might not exist yet
        console.log(`Resized version ${size} not available yet`);
      }
    }

    return resizedUrls;
  }

  /**
   * Delete an image and its resized versions
   * @param {string} path - Full storage path to the image
   */
  async deleteImage(path) {
    try {
      // Delete original
      const fileRef = ref(storage, path);
      await deleteObject(fileRef);

      // Try to delete resized versions
      const fileName = path.split('/').pop();
      const basePath = path.substring(0, path.lastIndexOf('/') + 1);
      const sizes = ['200x200', '400x400', '800x800'];

      // Get filename without extension and the extension separately
      const lastDotIndex = fileName.lastIndexOf('.');
      const nameWithoutExt = fileName.substring(0, lastDotIndex);
      const extension = fileName.substring(lastDotIndex);

      for (const size of sizes) {
        try {
          const resizedFileName = `${nameWithoutExt}_${size}${extension}`;
          const resizedRef = ref(storage, `${basePath}${resizedFileName}`);
          await deleteObject(resizedRef);
        } catch (error) {
          // Resized version might not exist
          console.log(`Could not delete resized version ${size}`);
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }

  /**
   * Generate a storage path for a bakery's images
   * @param {string} bakeryId - The bakery ID
   * @param {string} type - Type of image ('logos', 'products', etc.)
   * @returns {string} - Storage path
   */
  generatePath(bakeryId, type) {
    return `bakeries/${bakeryId}/${type}/`;
  }
}

export default new StorageService();
