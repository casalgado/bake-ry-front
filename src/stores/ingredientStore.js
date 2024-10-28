// stores/ingredientStore.js
import { createResourceStore } from "./base/resourceStore";
import { IngredientService } from "../services/ingredientService";
import { useAuthenticationStore } from "./authentication";
import { defineStore, storeToRefs } from "pinia";

export const useIngredientStore = defineStore("ingredients", () => {
  const authStore = useAuthenticationStore();
  const { getBakeryId } = storeToRefs(authStore);

  // Create service instance
  const getService = () => {
    if (!getBakeryId.value) {
      throw new Error("No bakery ID available");
    }
    return new IngredientService(getBakeryId.value);
  };

  // Get base store functionality
  const baseStore = createResourceStore("ingredients", getService());

  return {
    ...baseStore(),
  };
});
