import { defineComponent, h, onMounted, onUnmounted, ref, type PropType } from "vue";

import type { Checkout } from "@mainmoney/js-checkout";
import { mountCheckout } from "@mainmoney/js-checkout";

export const CheckoutWizard = defineComponent({
  name: "MainMoneyCheckoutWizard",
  props: {
    checkout: { type: Object as PropType<Checkout>, required: true },
    logoUrl: { type: String, required: false },
  },
  setup(props) {
    const host = ref<HTMLElement | null>(null);
    let unmount: (() => void) | undefined;
    onMounted(() => {
      if (host.value !== null) {
        unmount = mountCheckout(host.value, props.checkout, { logoUrl: props.logoUrl });
      }
    });
    onUnmounted(() => unmount?.());
    return () => h("div", { ref: host });
  },
});
