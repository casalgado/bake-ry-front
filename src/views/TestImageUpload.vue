<script setup>
import { ref, computed } from 'vue';
import { useAuthenticationStore } from '@/stores/authentication';
import storageService from '@/services/storageService';

const authStore = useAuthenticationStore();
const bakeryId = computed(() => authStore.user?.bakeryId || 'test-bakery');

const selectedFile = ref(null);
const uploadProgress = ref(0);
const uploadResult = ref(null);
const error = ref(null);
const isUploading = ref(false);

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    error.value = null;
    uploadResult.value = null;
  }
};

const uploadImage = async () => {
  if (!selectedFile.value) {
    error.value = 'Please select a file first';
    return;
  }

  try {
    isUploading.value = true;
    error.value = null;
    uploadProgress.value = 0;

    const path = storageService.generatePath(bakeryId.value, 'test-logos');
    console.log('Uploading to path:', path);

    const result = await storageService.uploadImage(
      selectedFile.value,
      path,
      (progress) => {
        uploadProgress.value = Math.round(progress);
        console.log(`Upload progress: ${progress}%`);
      },
    );

    console.log('Upload complete:', result);
    uploadResult.value = result;
  } catch (err) {
    console.error('Upload failed:', err);
    error.value = err.message || 'Upload failed';
  } finally {
    isUploading.value = false;
  }
};

const deleteImage = async () => {
  if (!uploadResult.value) return;

  try {
    const fullPath = `${uploadResult.value.path}${uploadResult.value.fileName}`;
    await storageService.deleteImage(fullPath);
    uploadResult.value = null;
    selectedFile.value = null;
    console.log('Image deleted successfully');
  } catch (err) {
    console.error('Delete failed:', err);
    error.value = err.message || 'Delete failed';
  }
};
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Test Image Upload</h1>

    <!-- File Input -->
    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Select Image
      </label>
      <input
        type="file"
        accept="image/*"
        @change="handleFileSelect"
        class="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
      />
      <p v-if="selectedFile" class="mt-2 text-sm text-gray-600">
        Selected: {{ selectedFile.name }} ({{ (selectedFile.size / 1024).toFixed(2) }} KB)
      </p>
    </div>

    <!-- Upload Button -->
    <div class="mb-6">
      <button
        @click="uploadImage"
        :disabled="!selectedFile || isUploading"
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        <span v-if="isUploading">Uploading... {{ uploadProgress }}%</span>
        <span v-else>Upload Image</span>
      </button>
    </div>

    <!-- Progress Bar -->
    <div v-if="isUploading" class="mb-6">
      <div class="w-full bg-gray-200 rounded-full h-2.5">
        <div
          class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          :style="{ width: `${uploadProgress}%` }"
        ></div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
      Error: {{ error }}
    </div>

    <!-- Success Result -->
    <div v-if="uploadResult" class="mb-6 p-4 bg-green-100 border border-green-400 rounded">
      <h3 class="font-bold text-green-800 mb-2">Upload Successful!</h3>

      <div class="space-y-2 text-sm">
        <p><strong>File Name:</strong> {{ uploadResult.fileName }}</p>
        <p><strong>Path:</strong> {{ uploadResult.path }}</p>

        <!-- Original Image -->
        <div class="mt-4">
          <h4 class="font-semibold mb-2">Original Image:</h4>
          <img
            :src="uploadResult.originalUrl"
            alt="Original"
            class="max-w-md border border-gray-300 rounded"
          />
          <p class="text-xs mt-1 text-gray-600 break-all">{{ uploadResult.originalUrl }}</p>
        </div>

        <!-- Resized Images -->
        <div v-if="Object.keys(uploadResult.resizedUrls).length > 0" class="mt-4">
          <h4 class="font-semibold mb-2">Resized Versions:</h4>
          <div class="grid grid-cols-3 gap-4">
            <div v-for="(url, size) in uploadResult.resizedUrls" :key="size">
              <p class="text-xs font-medium mb-1">{{ size }}</p>
              <img
                :src="url"
                :alt="size"
                class="border border-gray-300 rounded"
              />
            </div>
          </div>
        </div>

        <!-- No Resized Images Yet -->
        <div v-else class="mt-4 p-3 bg-yellow-100 rounded">
          <p class="text-sm text-yellow-800">
            Resized images not available yet. The Firebase extension may still be processing.
            Try refreshing in a few seconds.
          </p>
        </div>

        <!-- Delete Button -->
        <button
          @click="deleteImage"
          class="mt-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Delete Image
        </button>
      </div>
    </div>

    <!-- Debug Info -->
    <div class="mt-8 p-4 bg-gray-100 rounded">
      <h3 class="font-bold mb-2">Debug Info:</h3>
      <p class="text-sm"><strong>Bakery ID:</strong> {{ bakeryId }}</p>
      <p class="text-sm"><strong>Storage Path:</strong> bakeries/{{ bakeryId }}/test-logos/</p>
    </div>
  </div>
</template>
