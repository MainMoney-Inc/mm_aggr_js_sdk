# Vue 3

**Purpose.** Use `CheckoutWizard` from `@mainmoneyapp/js-vue`.

**Prerequisites.** [frameworks/README.md](README.md); `npm install @mainmoneyapp/js-vue`; Vue ^3.

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { CheckoutWizard } from "@mainmoneyapp/js-vue";
import type { Checkout } from "@mainmoneyapp/js-checkout";
import "@mainmoneyapp/js-checkout/styles.css";
import { buildCheckout, startPayment } from "./payment";

const props = defineProps<{ scheme?: "light" | "dark" | "auto" }>();
const checkout = shallowRef<Checkout | null>(null);   // shallowRef: do not make the Checkout reactive
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const instance = buildCheckout(await startPayment());
    await instance.loadCountries();
    checkout.value = instance;
  } catch (e) {
    error.value = (e as Error).message;
  }
});
onBeforeUnmount(() => checkout.value?.close());
</script>

<template>
  <p v-if="error" role="alert">{{ error }}</p>
  <CheckoutWizard v-else-if="checkout" :checkout="checkout" :color-scheme="props.scheme" variant="embedded" />
  <p v-else>Starting checkout…</p>
</template>
```

Notes:

- Use `shallowRef` (or `markRaw`) so Vue does not wrap the `Checkout` object in a deep reactive proxy.
- The wrapper mounts in `onMounted` using the **initial** `checkout`, `logoUrl` and `variant` props: it does not re-mount
  when they change later. To switch to a new `Checkout` (retry with a new session) re-create the component, for example
  `<CheckoutWizard :key="attempt" :checkout="checkout" />`.
- `colorScheme` is watched (immediately and on change) and calls `checkout.setColorScheme`; when the prop is `undefined` the
  `createCheckout` value is kept.
- The wrapper unmounts its DOM on unmount but does not call `close()`.
- `layout`, `defaultCountry`, `links` are not props: mount yourself with `mountCheckout(el, checkout, options)` in
  `onMounted` and call the returned function in `onBeforeUnmount`.
- Observe the end: `const stop = checkout.value.subscribe(...)`, and call `stop()` in `onBeforeUnmount`.

## Error cases

| Symptom | Cause |
| --- | --- |
| Widget resets | `Checkout` created in `setup()` body per render path, or the component keyed anew |
| New props do nothing | Props are read once at mount: use `:key` |
| Slow or odd behaviour | `Checkout` stored in a deep `ref` instead of `shallowRef` |
