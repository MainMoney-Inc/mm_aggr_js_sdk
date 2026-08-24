<script setup lang="ts">
import { onMounted, ref } from "vue";

import { listOrders, refundOrder, type Order } from "./api";

const orders = ref<Order[]>([]);
const error = ref<string | null>(null);

async function reload(): Promise<void> {
  try {
    orders.value = await listOrders();
  } catch (err) {
    error.value = (err as Error).message;
  }
}

onMounted(() => {
  void reload();
});
</script>

<template>
  <h1>Refund</h1>
  <p v-if="error" class="error">{{ error }}</p>
  <p v-if="orders.length === 0">No orders yet. Pay for a product first.</p>
  <article v-for="order in orders" :key="order.id" class="card">
    <p>Ref {{ order.reference }} — {{ order.amount }} {{ order.currency }} — <strong>{{ order.status }}</strong></p>
    <button v-if="order.status === 'paid'" type="button" @click="refundOrder(order.id).then(reload).catch((err: Error) => (error = err.message))">
      Refund
    </button>
  </article>
</template>
