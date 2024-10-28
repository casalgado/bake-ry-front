console.log("Initializing store:", "authentication");
import { defineStore } from "pinia";
import { auth } from "../config/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import axios from "axios";

const development = import.meta.env.VITE_USE_AUTH_EMULATOR === "true";
const API_URL = development
  ? "http://localhost:5001/bake-ry/us-central1/bake"
  : import.meta.env.VITE_API_URL;

const VALID_ROLES = {
  BAKERY_ADMIN: "bakery_admin",
  BAKERY_STAFF: "bakery_staff",
  BAKERY_CUSTOMER: "bakery_customer",
};

// User data transformer
function transformUserData(firebaseUser, backendData = {}) {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: backendData.name || null,
    role: backendData.role || null,
    bakeryId: backendData.bakeryId || null,
    emailVerified: firebaseUser.emailVerified,
  };
}

export const useAuthenticationStore = defineStore("authentication", {
  state: () => ({
    user: null,
    idToken: null,
    loading: false,
    error: null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.user && !!state.idToken,
    getUserData: (state) => state.user,
    getBakeryId: (state) => state.user?.bakeryId,
    isSystemAdmin: (state) => state.user?.role === "system_admin",
    isBakeryAdmin: (state) => state.user?.role === VALID_ROLES.BAKERY_ADMIN,
    isBakeryStaff: (state) => state.user?.role === VALID_ROLES.BAKERY_STAFF,
    isBakeryCustomer: (state) =>
      state.user?.role === VALID_ROLES.BAKERY_CUSTOMER,
    hasAssignedBakery: (state) => !!state.user?.bakeryId,
  },

  actions: {
    async register(userData) {
      if (
        !userData.role ||
        !Object.values(VALID_ROLES).includes(userData.role)
      ) {
        throw new Error("Invalid role specified");
      }

      if (userData.role === VALID_ROLES.BAKERY_ADMIN) {
        return this.registerBakeryAdmin(userData);
      } else {
        return this.registerBakeryUser(userData);
      }
    },

    async registerBakeryAdmin({ email, password, name }) {
      this.loading = true;
      this.error = null;

      try {
        if (!email || !password || !name) {
          throw new Error("Email, password, and name are required");
        }

        const response = await axios.post(`${API_URL}/auth/register`, {
          email,
          password,
          name,
          role: VALID_ROLES.BAKERY_ADMIN,
          bakeryId: null,
        });

        // Login the user
        await this.login({ email, password });
        console.log("Bakery admin registered:", this.user);
        return {
          success: true,
          user: response.data,
        };
      } catch (error) {
        console.error("Bakery admin registration error:", error);
        this.error = error.message || "Registration failed";
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async registerBakeryUser({ email, password, name, role, bakeryId }) {
      this.loading = true;
      this.error = null;

      try {
        if (!this.isBakeryAdmin) {
          throw new Error("Only bakery admins can create bakery users");
        }

        if (!email || !password || !name || !role || !bakeryId) {
          throw new Error(
            "All fields are required for bakery user registration"
          );
        }

        if (
          ![VALID_ROLES.BAKERY_STAFF, VALID_ROLES.BAKERY_CUSTOMER].includes(
            role
          )
        ) {
          throw new Error("Invalid role for bakery user");
        }

        if (this.user.bakeryId && this.user.bakeryId !== bakeryId) {
          throw new Error("Cannot create user for different bakery");
        }

        const response = await axios.post(
          `${API_URL}/auth/register`,
          {
            email,
            password,
            name,
            role,
            bakeryId,
          },
          {
            headers: {
              Authorization: `Bearer ${this.idToken}`,
            },
          }
        );

        // Transform the response data
        const registeredUser = transformUserData(
          { uid: response.data.user.uid, email, emailVerified: false },
          response.data.user
        );
        console.log("Bakery user registered:", registeredUser);
        return {
          success: true,
          user: registeredUser,
        };
      } catch (error) {
        console.error("Bakery user registration error:", error);
        this.error = error.message || "Registration failed";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async login({ email, password }) {
      this.loading = true;
      this.error = null;

      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const firebaseUser = userCredential.user;
        const idToken = await firebaseUser.getIdToken(true);

        try {
          const response = await axios.post(
            `${API_URL}/auth/login`,
            { email },
            {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            }
          );
          console.log("Backend login response:", response.data);
          this.user = transformUserData(firebaseUser, response.data);
          this.idToken = idToken;

          localStorage.setItem("AuthToken", idToken);
          localStorage.setItem("email", email);
          console.log("User logged in:", this.user);
          return {
            success: true,
            user: this.user,
          };
        } catch (backendError) {
          console.error("Backend login failed:", backendError);
          await signOut(auth);
          throw new Error(
            backendError.response?.data?.error ||
              "Backend authentication failed"
          );
        }
      } catch (error) {
        console.error("Login error:", error);

        let errorMessage;
        switch (error.code) {
          case "auth/operation-not-allowed":
            errorMessage =
              "Email/Password sign-in is not enabled. Please contact support.";
            break;
          case "auth/user-disabled":
            errorMessage = "This account has been disabled.";
            break;
          case "auth/user-not-found":
          case "auth/wrong-password":
            errorMessage = "Invalid email or password.";
            break;
          default:
            errorMessage = error.message || "Login failed. Please try again.";
        }

        this.error = errorMessage;
        throw new Error(errorMessage);
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await signOut(auth);
        this.user = null;
        this.idToken = null;
        localStorage.removeItem("AuthToken");
        localStorage.removeItem("email");
        console.log("User logged out");
      } catch (error) {
        console.error("Logout error:", error);
        throw error;
      }
    },

    async checkAuth() {
      return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
          auth,
          async (user) => {
            if (user) {
              try {
                const idToken = await user.getIdToken(true);

                // Fetch user data from backend
                const response = await axios.post(
                  `${API_URL}/auth/login`,
                  { email: user.email },
                  {
                    headers: {
                      Authorization: `Bearer ${idToken}`,
                    },
                  }
                );

                this.idToken = idToken;
                this.user = transformUserData(user, response.data);
                localStorage.setItem("AuthToken", idToken);
                localStorage.setItem("email", user.email);
                resolve(this.user);
                console.log("User authenticated:", this.user);
              } catch (error) {
                reject(error);
              }
            } else {
              this.user = null;
              this.idToken = null;
              resolve(null);
              console.log("User not authenticated");
            }
            unsubscribe();
          },
          (error) => {
            reject(error);
            unsubscribe();
          }
        );
      });
    },

    async refreshToken() {
      if (auth.currentUser) {
        this.idToken = await auth.currentUser.getIdToken(true);
        localStorage.setItem("AuthToken", this.idToken);
      }
    },
  },
});
