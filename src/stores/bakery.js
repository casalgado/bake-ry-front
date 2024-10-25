import { defineStore } from "pinia";

export const useBakeryStore = defineStore("bakery", {
  state: () => ({
    bakery: null,
  }),
  actions: {
    async createBakery(bakeryData) {
      console.log(bakeryData);
    },
  },
});
