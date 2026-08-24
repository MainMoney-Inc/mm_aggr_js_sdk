<script setup lang="ts">
import { backendUrl } from "./api";
</script>

<template>
  <nav>
    <router-link to="/">Products</router-link>
    <router-link to="/refund">Refund</router-link>
    <router-link to="/transfer">Transfer</router-link>
    <span style="margin-left: auto; color: #aaa">backend {{ backendUrl() }}</span>
  </nav>
  <main>
    <router-view />
  </main>
</template>
