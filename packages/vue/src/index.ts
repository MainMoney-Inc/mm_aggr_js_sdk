import { defineComponent, h, onMounted, onUnmounted, ref, watch, type PropType } from "vue";

import type { Checkout, CheckoutVariant, ColorScheme } from "@mainmoneyapp/js-checkout";
import { mountCheckout } from "@mainmoneyapp/js-checkout";

export const CheckoutWizard = defineComponent({
  name: "MainMoneyCheckoutWizard",
  props: {
    checkout: { type: Object as PropType<Checkout>, required: true },
    logoUrl: { type: String, required: false },
    /** Live palette: every change calls `checkout.setColorScheme` without re-rendering the form. */
    colorScheme: { type: String as PropType<ColorScheme>, required: false },
    variant: { type: String as PropType<CheckoutVariant>, required: false },
  },
  setup(props) {
    const host = ref<HTMLElement | null>(null);
    let unmount: (() => void) | undefined;
    onMounted(() => {
      if (host.value !== null) {
        unmount = mountCheckout(host.value, props.checkout, { logoUrl: props.logoUrl, variant: props.variant });
      }
    });
    onUnmounted(() => unmount?.());
    watch(
      () => props.colorScheme,
      (scheme) => {
        if (scheme !== undefined) {
          props.checkout.setColorScheme(scheme);
        }
      },
      { immediate: true },
    );
    return () => h("div", { ref: host });
  },
});
