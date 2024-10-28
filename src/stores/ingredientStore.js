// stores/ingredientStore.js
console.log("Initializing store:", "ingredient");
import { createResourceStore } from "./base/resourceStore";
import { IngredientService } from "../services/ingredientService";
import { useAuthenticationStore } from "./authentication";
import { storeToRefs } from "pinia";

// Get bakeryId from auth store
const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

// Create service instance with bakeryId
const service = new IngredientService(getBakeryId.value);

export const useIngredientStore = createResourceStore("ingredients", service);
