<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar />
    <main class="flex flex-1 overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppSidebar from './components/layout/AppSidebar.vue'
</script>
