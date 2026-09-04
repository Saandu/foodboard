<template>
  <div class="allergens">
    <div class="input-label">{{ $t('allergens') }}</div>
    <div class="checkbox-group">
      <div v-for="option in store.allAllergens" :key="option.id" class="checkbox-container">
        <div class="checkbox-item">
          <input @change="updateAllergens(option.id)" :id="'allergen-' + option.id" class="checkbox-text" type="checkbox"
                 :value="option.id"
                 :checked="allergens.includes(option.id)">
          <label :for="'allergen-' + option.id">{{ $t(option.key) }}</label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useStore } from '../stores/store.js'

const emits = defineEmits(['updateAllergens'])
defineProps({
  allergens: {
    required: true
  }
})

const store = useStore()

const updateAllergens = (id) => {
  emits('updateAllergens', id)
}
</script>

<style scoped>
.allergens {
  width: 90%;
}

.checkbox-container {
  width: 50%;
  margin-bottom: 5px;
}

.checkbox-item {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

@media screen and (max-width: 576px) {
  .checkbox-container {
    width: 100%;
  }
}

input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.checkbox-group {
  margin-top: 20px;
  width: 60%;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.checkbox-text {
  justify-content: center;
  align-items: center;
  line-height: 2rem;
  font-weight: 500;
  color: #bdbab8;
}

input[type="checkbox"]:checked {
  accent-color: #E6E5E1;
}

input[type="checkbox"]:hover {
  box-shadow: 0 0 0 0.2rem rgb(197 223 148 / 35%);
  border-color: #c5df94;
  accent-color: #d9d9d9;
  outline: 0;
}

.checkbox-item * {
  cursor: pointer;
  font-size: 1.2rem;
}
</style>
