<script setup>
import { ref, computed, watch } from 'vue';
import { PhUpload, PhTrash, PhImage, PhSpinner } from '@phosphor-icons/vue';
import storageService from '@/services/storageService';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  uploadPath: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: 'Imagen',
  },
  helpText: {
    type: String,
    default: 'Arrastra una imagen o haz clic para seleccionar',
  },
  acceptedFormats: {
    type: String,
    default: 'image/jpeg,image/png,image/gif,image/webp',
  },
  maxSizeInMB: {
    type: Number,
    default: 5,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'upload-success', 'upload-error', 'delete-success', 'delete-error']);

// State
const selectedFile = ref(null);
const previewUrl = ref('');
const uploadProgress = ref(0);
const isUploading = ref(false);
const isDragging = ref(false);
const error = ref('');
const fileInputRef = ref(null);

// Initialize preview with current value
watch(() => props.modelValue, (newVal) => {
  if (newVal && !selectedFile.value) {
    previewUrl.value = newVal;
  }
}, { immediate: true });

// Computed
const hasImage = computed(() => {
  return previewUrl.value || props.modelValue;
});

const maxSizeInBytes = computed(() => {
  return props.maxSizeInMB * 1024 * 1024;
});

// Methods
const handleFileSelect = (event) => {
  const file = event.target.files?.[0];
  if (file) {
    processFile(file);
  }
};

const handleDrop = (event) => {
  event.preventDefault();
  isDragging.value = false;

  const file = event.dataTransfer.files?.[0];
  if (file) {
    processFile(file);
  }
};

const handleDragOver = (event) => {
  event.preventDefault();
  if (!props.disabled) {
    isDragging.value = true;
  }
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const processFile = (file) => {
  error.value = '';

  // Validate file type
  if (!file.type.startsWith('image/')) {
    error.value = 'Por favor selecciona un archivo de imagen válido';
    return;
  }

  // Validate file size
  if (file.size > maxSizeInBytes.value) {
    error.value = `El archivo debe ser menor a ${props.maxSizeInMB} MB`;
    return;
  }

  selectedFile.value = file;

  // Create preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target.result;
  };
  reader.readAsDataURL(file);

  // Auto-upload when file is selected
  uploadImage();
};

const uploadImage = async () => {
  if (!selectedFile.value || props.disabled) return;

  try {
    isUploading.value = true;
    error.value = '';
    uploadProgress.value = 0;

    const result = await storageService.uploadImage(
      selectedFile.value,
      props.uploadPath,
      (progress) => {
        uploadProgress.value = Math.round(progress);
      },
    );

    // Emit the original URL as the new value
    emit('update:modelValue', result.originalUrl);
    emit('upload-success', result);

    // Reset file selection
    selectedFile.value = null;
    uploadProgress.value = 0;
  } catch (err) {
    console.error('Upload failed:', err);
    error.value = err.message || 'Error al subir la imagen';
    emit('upload-error', err);

    // Reset on error
    selectedFile.value = null;
    previewUrl.value = props.modelValue || '';
    uploadProgress.value = 0;
  } finally {
    isUploading.value = false;
  }
};

const deleteImage = async () => {
  if (!props.modelValue || props.disabled) return;

  try {
    // Extract the path from the URL
    // Firebase Storage URLs contain the path after "/o/"
    const url = new URL(props.modelValue);
    const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
    if (!pathMatch) {
      throw new Error('Invalid storage URL');
    }

    const storagePath = decodeURIComponent(pathMatch[1]);
    await storageService.deleteImage(storagePath);

    // Clear the image
    previewUrl.value = '';
    emit('update:modelValue', '');
    emit('delete-success');
  } catch (err) {
    console.error('Delete failed:', err);
    error.value = err.message || 'Error al eliminar la imagen';
    emit('delete-error', err);
  }
};

const triggerFileInput = () => {
  if (!props.disabled && fileInputRef.value) {
    fileInputRef.value.click();
  }
};
</script>

<template>
  <div class="image-upload-container">
    <label v-if="label" class="block text-sm font-medium text-neutral-700 mb-2">
      {{ label }}
    </label>

    <!-- Upload Area -->
    <div
      class="upload-area"
      :class="{
        'dragging': isDragging,
        'disabled': disabled,
        'has-error': error
      }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="triggerFileInput"
    >
      <!-- Preview or Placeholder -->
      <div v-if="hasImage && !isUploading" class="image-preview">
        <img :src="previewUrl" :alt="label" class="preview-image" />
        <div class="overlay">
          <button
            v-if="!disabled"
            @click.stop="deleteImage"
            class="delete-button"
            type="button"
            title="Eliminar imagen"
          >
            <PhTrash :size="20" />
          </button>
        </div>
      </div>

      <!-- Upload Progress -->
      <div v-else-if="isUploading" class="upload-progress">
        <PhSpinner :size="48" class="animate-spin text-primary" />
        <p class="text-sm text-neutral-600 mt-2">Subiendo... {{ uploadProgress }}%</p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <PhImage :size="48" class="text-neutral-400" />
        <p class="text-sm text-neutral-600 mt-2">{{ helpText }}</p>
        <p class="text-xs text-neutral-500 mt-1">
          Máximo {{ maxSizeInMB }} MB • JPG, PNG, GIF, WebP
        </p>
      </div>
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInputRef"
      type="file"
      :accept="acceptedFormats"
      @change="handleFileSelect"
      :disabled="disabled"
      class="hidden"
    />

    <!-- Error Message -->
    <p v-if="error" class="text-danger text-xs mt-2">{{ error }}</p>
  </div>
</template>

<style scoped lang="scss">
.image-upload-container {
  .upload-area {
    border: 2px dashed #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background-color: #fafafa;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;

    &:hover:not(.disabled) {
      border-color: #d1d5db;
      background-color: #f9fafb;
    }

    &.dragging {
      border-color: #3b82f6;
      background-color: #eff6ff;
    }

    &.disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &.has-error {
      border-color: #ef4444;
      background-color: #fef2f2;
    }
  }

  .image-preview {
    position: relative;
    width: 100%;
    height: 100%;

    .preview-image {
      max-width: 100%;
      max-height: 300px;
      object-fit: contain;
      border-radius: 0.375rem;
    }

    .overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      border-radius: 0.375rem;
    }

    &:hover .overlay {
      opacity: 1;
    }

    .delete-button {
      background-color: #ef4444;
      color: white;
      padding: 0.5rem;
      border-radius: 0.375rem;
      transition: background-color 0.2s;

      &:hover {
        background-color: #dc2626;
      }
    }
  }

  .upload-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;

    .progress-bar {
      width: 100%;
      max-width: 200px;
      height: 4px;
      background-color: #e5e7eb;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 1rem;

      .progress-fill {
        height: 100%;
        background-color: #3b82f6;
        transition: width 0.3s;
      }
    }
  }

  .empty-state {
    padding: 2rem;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
}
</style>