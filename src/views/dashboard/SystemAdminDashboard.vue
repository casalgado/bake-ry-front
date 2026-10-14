<script setup>
import AdminSidebar from '@/components/layouts/AdminSidebar.vue';
</script>

<template>
  <section class="relative grid lg:grid-cols-[200px_1fr] transition-all h-full">
    <AdminSidebar />
    <div class="relative grid justify-items-center grid-cols-1 bg-neutral-150 pb-20 lg:pb-5 h-full overflow-auto ui-gutter">
      <RouterView />
    </div>
  </section>
</template>

<style scoped>
</style>
