# Wayfare Vue 3 Frontend

## Структура проекта

```
src/frontend/
├── assets/          # Статические файлы (CSS, изображения)
├── components/      # Переиспользуемые Vue компоненты
├── router/          # Конфигурация маршрутизации
├── services/        # API сервисы (Axios)
├── stores/          # Pinia stores (управление состоянием)
├── views/           # Страницы приложения
├── App.vue          # Корневой компонент
├── main.ts          # Точка входа
└── index.html       # HTML шаблон
```

## Технологии

- **Vue 3** - фреймворк с Composition API
- **TypeScript** - типизация
- **Vite** - сборка проекта
- **Vue Router** - маршрутизация
- **Pinia** - управление состоянием
- **PrimeVue** - UI компоненты

## Команды

```bash
# Запуск Vite dev сервера (горячая перезагрузка)
npm run dev:vue

# Сборка Vue приложения
npm run build:vue

# Полная сборка проекта (Vue + NestJS)
npm run build
```

## Разработка

### Запуск в режиме разработки

1. Запустите Vite dev сервер:
```bash
npm run dev:vue
```

2. Откройте http://localhost:3000

Dev сервер автоматически проксирует `/api` запросы на NestJS сервер (порт 4000).

### Добавление нового компонента

```vue
<template>
  <div class="my-component">
    <!-- Template code -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// Props
defineProps<{
  title?: string
}>()

// Emits
const emit = defineEmits<{
  (e: 'update', value: string): void
}>()

// State
const count = ref(0)
</script>

<style scoped>
.my-component {
  /* Styles */
}
</style>
```

### Работа с Pinia Store

```typescript
// stores/exampleStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useExampleStore = defineStore('example', () => {
  const data = ref(null)
  const loading = ref(false)

  function setData(value: any) {
    data.value = value
  }

  return { data, loading, setData }
})
```

Использование в компоненте:
```vue
<script setup lang="ts">
import { useExampleStore } from '@/stores/exampleStore'

const store = useExampleStore()
store.setData({ key: 'value' })
</script>
```

### API запросы

```typescript
// services/apiService.ts
import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const myService = {
  async getData(id: string) {
    const response = await apiClient.get(`/data/${id}`)
    return response.data
  },
}
```

## Сборка и деплой

### Production сборка

```bash
npm run build
```

Vue приложение будет собрано в `dist/frontend/` и автоматически обслуживается NestJS сервером.

### Запуск production сервера

```bash
npm run start:prod
```

## Интеграция с NestJS Backend

Vue приложение настроено на проксирование API запросов:

- Dev: `http://localhost:3000/api/*` → `http://localhost:4000/api/*`
- Production: `/api/*` обслуживается NestJS

## Стилизация

### Глобальные стили

Добавляйте в `src/frontend/assets/styles.css`

### Scoped стили

Используйте `<style scoped>` в компонентах для изоляции стилей.

### PrimeVue темы

Тема подключена в `main.ts`:
```typescript
import 'primevue/resources/themes/lara-light-blue/theme.css'
```

Доступные темы: https://primevue.org/theming/

## Расширение функциональности

### Добавление новой страницы

1. Создайте view компонент в `src/frontend/views/`
2. Добавьте маршрут в `src/frontend/router/index.ts`
3. Используйте `<router-link>` для навигации

### Добавление API endpoint

1. Создайте сервис в `src/frontend/services/`
2. Используйте в компонентах через Pinia store или напрямую

## Отладка

### Vue DevTools

Установите расширение Vue DevTools для Chrome/Firefox для отладки компонентов и Pinia stores.

### Логи

Используйте `console.log` или подключите плагины логирования для Pinia.
