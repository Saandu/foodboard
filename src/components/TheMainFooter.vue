<template><footer class="app-footer"><div class="container app-footer__inner"><span>FoodBoard</span><span>Digital menu workspace</span><span>© {{ year }}</span></div></footer></template>
<script setup>const year = new Date().getFullYear()</script>
<style scoped>
.app-footer { border-top: 1px solid var(--c-line); background: var(--c-surface); }.app-footer__inner { display: flex; flex-wrap: wrap; gap: var(--s-2) var(--s-4); padding-top: var(--s-4); padding-bottom: var(--s-4); color: var(--c-ink-3); font-size: .78rem; }.app-footer__inner span:first-child { color: var(--c-ink); font-weight: 750; }.app-footer__inner span:last-child { margin-left: auto; }@media (max-width: 480px) { .app-footer__inner span:last-child { margin-left: 0; } }
</style>
