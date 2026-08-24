<script setup lang="ts">
import { createCheckout } from "@mainmoney/js-checkout";
import { createSession } from "@mainmoney/js-core";
import { CheckoutWizard } from "@mainmoney/js-vue";
import "@mainmoney/js-checkout/styles.css";
import type { Checkout } from "@mainmoney/js-checkout";
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import { createPaySession } from "./api";

const route = useRoute();
const checkout = ref<Checkout | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const cfg = await createPaySession(Number(route.params.id));
    const session = createSession({
      merchantBackendUrl: cfg.merchantBackendUrl,
      clientToken: cfg.clientToken,
      locale: cfg.locale ?? "en",
    });
    const instance = createCheckout(session, {
      operation: "deposit",
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
});
</script>

<template>
  <h1>Pay</h1>
  <p v-if="error" class="error">{{ error }}</p>
  <CheckoutWizard v-if="checkout" :checkout="checkout" />
  <p v-else-if="!error">Starting checkout…</p>
</template>
