<template>
  <div class="app-layout">
    <nav class="navbar">
      <div class="navbar-container">
        <router-link to="/" class="navbar-brand">Wayfare</router-link>
      </div>
    </nav>

    <main class="main-content">
      <div class="container">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// Layout component
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background-color: #1e3352;
  padding: 0.875rem 1rem;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
}

.navbar-container {
  max-width: 1200px;
  margin: 0 auto;
}

.navbar-brand {
  color: #c8d8ee;
  text-decoration: none;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.main-content {
  flex: 1;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}
</style>
