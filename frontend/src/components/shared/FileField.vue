<template>
  <label class="native-field native-file-field">
    <span>{{ label }}</span>
    <input
      ref="inputRef"
      class="native-file-input"
      type="file"
      :accept="accept"
      :required="required"
      :disabled="disabled"
      @change="handleFileChange"
    />
    <div class="native-file-field__surface">
      <button
        type="button"
        class="secondary native-file-field__button"
        @click="openFilePicker"
        :disabled="disabled"
      >
        {{ buttonLabel }}
      </button>
      <span class="native-file-field__meta">{{ displayFileName }}</span>
    </div>
  </label>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  accept: {
    type: String,
    default: ""
  },
  file: {
    type: Object,
    default: null
  },
  onChange: {
    type: Function,
    default: null
  },
  buttonLabel: {
    type: String,
    default: "选择文件"
  },
  disabled: {
    type: Boolean,
    default: false
  },
  required: {
    type: Boolean,
    default: false
  }
})

const inputRef = ref(null)

const displayFileName = computed(() => {
  return props.file?.name || "未选择文件"
})

const openFilePicker = () => {
  inputRef.value?.click()
}

const handleFileChange = (event) => {
  const selectedFile = event.target.files?.[0] || null
  if (props.onChange) {
    props.onChange(selectedFile)
  }
  // 清空 input 的值，以便同一个文件可以再次选择
  if (inputRef.value) {
    inputRef.value.value = ""
  }
}
</script>

<style scoped>
.native-file-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.native-file-field span {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.native-file-input {
  display: none;
}

.native-file-field__surface {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition: all 0.2s;
}

.native-file-field__surface:hover {
  border-color: var(--primary-color);
}

.native-file-field__button {
  flex-shrink: 0;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.native-file-field__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.native-file-field__meta {
  flex: 1;
  font-size: 0.875rem;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>