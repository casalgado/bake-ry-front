// stores/ingredientStore.js
import { createResourceStore } from "./base/resourceStore";
import { IngredientService } from "../services/ingredientService";

const ingredientService = new IngredientService();

// Create and export the store using the base functionality
export const useIngredientStore = createResourceStore(
  "ingredients",
  ingredientService
);
