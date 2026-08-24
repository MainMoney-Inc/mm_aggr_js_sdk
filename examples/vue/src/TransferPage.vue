<script setup lang="ts">
import { createCheckout } from "@mainmoney/js-checkout";
import { createSession } from "@mainmoney/js-core";
import { CheckoutWizard } from "@mainmoney/js-vue";
import "@mainmoney/js-checkout/styles.css";
import type { Checkout } from "@mainmoney/js-checkout";
import { onMounted, ref } from "vue";

import { createPayoutSession, listTransfers, type Transfer } from "./api";

const checkout = ref<Checkout | null>(null);
const transfers = ref<Transfer[]>([]);
const error = ref<string | null>(null);
const amount = ref("5.00");
const currency = ref("USD");

onMounted(async () => {
  try {
    transfers.value = await listTransfers();
  } catch (err) {
    error.value = (err as Error).message;
  }
});

async function startPayout(): Promise<void> {
  try {
    const cfg = await createPayoutSession(amount.value, currency.value);
    const session = createSession({
      merchantBackendUrl: cfg.merchantBackendUrl,
      clientToken: cfg.clientToken,
      locale: cfg.locale ?? "en",
    });
    const instance = createCheckout(session, {
      operation: "payout",
      pollUrl: cfg.pollUrl,
      pollHeaders: cfg.pollHeaders,
      amount: cfg.amount ?? undefined,
      lockAmount: cfg.lockAmount === true,
      reference: cfg.reference,
    });
    await instance.loadCountries();
    checkout.value = instance;
  } catch (err) {
    error.value = (err as Error).message;
  }
}
</script>

<template>
  <h1>Transfer (payout)</h1>
  <form class="card" @submit.prevent="startPayout">
    <p>
      <label>Amount <input v-model="amount" required /></label>
    </p>
    <p>
      <label>Currency <input v-model="currency" required /></label>
    </p>
    <button type="submit">Start payout</button>
  </form>
  <p v-if="error" class="error">{{ error }}</p>
  <CheckoutWizard v-if="checkout" :checkout="checkout" />
  <h2>Recent transfers</h2>
  <article v-for="item in transfers" :key="item.id" class="card">
    <p>Ref {{ item.reference }} — {{ item.amount }} {{ item.currency }} → {{ item.destination || "—" }} — <strong>{{ item.status }}</strong></p>
  </article>
</template>
