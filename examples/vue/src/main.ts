import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";

import App from "./App.vue";
import PayPage from "./PayPage.vue";
import ProductsPage from "./ProductsPage.vue";
import RefundPage from "./RefundPage.vue";
import TransferPage from "./TransferPage.vue";
import "./styles.css";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: ProductsPage },
    { path: "/pay/:id", component: PayPage },
    { path: "/refund", component: RefundPage },
    { path: "/transfer", component: TransferPage },
  ],
});

createApp(App).use(router).mount("#app");
