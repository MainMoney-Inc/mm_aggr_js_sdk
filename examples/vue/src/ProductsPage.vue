<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { listProducts, type Product } from "./api";

const router = useRouter();
const products = ref<Product[]>([]);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    products.value = await listProducts();
  } catch (err) {
    error.value = (err as Error).message;
  }
});
</script>

<template>
  <h1>Products</h1>
  <p v-if="error" class="error">{{ error }}</p>
  <article v-for="product in products" :key="product.id" class="card">
    <h2>{{ product.name }}</h2>
    <p>{{ product.description }}</p>
    <p>
      <strong>{{ product.price }} {{ product.currency }}</strong>
    </p>
    <button type="button" @click="router.push(`/pay/${product.id}`)">Pay</button>
  </article>
</template>
