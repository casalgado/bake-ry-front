// stores/recipeStore.js
import { createResourceStore } from "./base/resourceStore";
import { RecipeService } from "../services/recipeService";
import { useAuthenticationStore } from "./authentication";
import { storeToRefs } from "pinia";

// Get bakeryId from auth store
const authStore = useAuthenticationStore();
const { getBakeryId } = storeToRefs(authStore);

// Create service instance with bakeryId
const service = new RecipeService(getBakeryId.value);

export const useRecipeStore = createResourceStore("recipes", service);
