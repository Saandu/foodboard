<template>
  <div :class="{'checkboxContainer': type === 'checkbox'}"
       @input="handleInput($event)"
       @click="handleClick($event)"
       class="input-wrap">
    <div v-if="label && type !== 'checkbox'" class="label-container">
      <label :class="{ 'color-label': isColor }" :for="isColor ? id : undefined" class="input-label">
        {{ label }}
      </label>
    </div>
    <input v-if="type !== 'textarea'" class="field-input"
           :id="id"
           :type="type"
           :value="modelValue"
           :accept="accept"
           :checked="checked"
           :disabled="props.disabled"
    />
    <textarea v-if="type === 'textarea'" class="field-input"
              :value="modelValue"
    ></textarea>
    <div v-if="label && type === 'checkbox'" class="checkbox-text">{{ label }}</div>
  </div>
</template>

<script setup>
const emits = defineEmits(['updateCheckboxGroup', 'update:modelValue'])
const props = defineProps({
  label: {
    type: [String, Boolean],
    default: false
  },
  modelValue: {
    type: String,
    default: ''
  },
  accept: {
    type: String,
    default: ''
  },
  isColor: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'text'
  },
  checked: {
    type: Boolean,
    default: false
  },
  group: {
    type: Boolean,
    default: false
  },
  id: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean
  }
})

const handleClick = (event) => {
  if (props.group) {
    emits('updateCheckboxGroup', { optionId: props.id, checked: event.target.checked })
  } else {
    if (props.isColor === false && props.type !== 'text' && props.type !== 'textarea') {
      emits('update:modelValue', event.target.value)
    }
  }
}
const handleInput = (event) => {
  emits('update:modelValue', event.target.value)
}
</script>

<style scoped>
.input-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--s-2);
  padding: var(--s-3) 0;
}

.label-container {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: var(--s-2);
  min-width: 0;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--c-ink);
}

.field-input {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.5;
  color: var(--c-ink);
  background-color: var(--c-surface);
  border: 1px solid #cbd2cc;
  border-radius: var(--r-sm);
  transition: border-color .16s ease, box-shadow .16s ease;
  resize: none;
}

.field-input:focus {
  box-shadow: 0 0 0 3px rgba(47, 79, 67, 0.13);
  border-color: var(--c-brand);
  outline: 0;
}

.field-input:disabled { background: var(--c-line-2); color: var(--c-ink-3); cursor: not-allowed; }

textarea.field-input { min-height: 100px; resize: vertical; }

input[type="file"] {
  padding: 6px;
  color: var(--c-ink-2);
}

input[type="file"]::file-selector-button {
  min-height: 32px;
  margin-right: var(--s-3);
  padding: 0 var(--s-3);
  border: 0;
  border-radius: 6px;
  background: var(--c-line-2);
  color: var(--c-ink);
  font: 650 0.825rem/1 inherit;
  cursor: pointer;
}

input[type="color"] {
  padding: 4px;
  cursor: pointer;
  width: 64px;
  height: 42px;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: none;
}

.color-label {
  color: var(--c-ink);
}


.disabled-input input {
  background-color: #efefef;
}

.input-wrap { max-width: 760px; }

</style>
