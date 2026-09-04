<template>
  <div>
    <label class="label-select">
      {{ label }}
      <select :value="selected" class="select" @input="updateSelected">
        <option disabled value="">{{ placeholderOption }}</option>
        <option
            v-for="(option, i) in allOptions"
            :key="i"
            :style="options.includes(option.id) ? {color: 'black', fontWeight: '700'} : ''"
            :disabled="!options.includes(option.id)"
            :value="option.id"
        >{{ option.name }}
        </option>
      </select>
    </label>
  </div>
</template>

<script setup>
const emits = defineEmits(['update:selected'])
defineProps({
  label: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    required: true
  },
  allOptions: {
    type: Array,
    required: true
  },
  placeholderOption: {
    type: String,
    required: true
  },
  selected: {
    type: String,
    required: true
  }
})

const updateSelected = (event) => {
  emits('update:selected', event.target.value)
}
</script>

<style scoped>
.select {
  margin: var(--s-2) 0 var(--s-4);
  font-family: inherit;
  display: block;
  width: 100%;
  min-height: 42px;
  padding: 0 var(--s-3);
  font-size: 0.95rem;
  font-weight: 400;
  color: var(--c-ink);
  background-color: var(--c-surface);
  border: 1px solid #cbd2cc;
  border-radius: var(--r-sm);
}

.select:focus {
  box-shadow: 0 0 0 3px rgba(47, 79, 67, 0.13);
  border-color: var(--c-brand);
  outline: 0;
}

.label-select {
  display: block;
  margin-top: var(--s-4);
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--c-ink);
}
</style>
