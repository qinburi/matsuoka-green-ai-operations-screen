<script setup lang="ts">
const particles = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  x: (index * 37) % 100,
  y: (index * 61) % 100,
  delay: -((index * 0.31) % 12),
  duration: 8 + (index % 7),
  size: 2 + (index % 3),
}))
</script>

<template>
  <div class="v3-atmosphere" aria-hidden="true">
    <span class="v3-atmosphere__orb v3-atmosphere__orb--left" />
    <span class="v3-atmosphere__orb v3-atmosphere__orb--right" />
    <span class="v3-atmosphere__core" />
    <span class="v3-atmosphere__ring v3-atmosphere__ring--one" />
    <span class="v3-atmosphere__ring v3-atmosphere__ring--two" />
    <i
      v-for="particle in particles"
      :key="particle.id"
      class="v3-atmosphere__particle"
      :style="{ left: `${particle.x}%`, top: `${particle.y}%`, width: `${particle.size}px`, height: `${particle.size}px`, animationDelay: `${particle.delay}s`, animationDuration: `${particle.duration}s` }"
    />
  </div>
</template>
