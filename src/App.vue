<script setup>
import GlobalLayout from './layouts/GlobalLayout.vue'
</script>

<template>
  <GlobalLayout>
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </GlobalLayout>
</template>
