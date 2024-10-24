import { defineStore } from "pinia";
import { auth } from "../main";
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

function saveUserData(uid, email, name) {}

function getUserData(uid) {}

export const useAuthenticationStore = defineStore("authentication", {
  state: () => ({
    user: null,
    uid: null,
    idToken: null,
  }),
  getters: {
    isLoggedIn: (state) => state.user,
    isSystemAdmin: (state) => {},
    isBakeryAdmin: (state) => {},
    isBakeryStaff: (state) => {},
    isBakeryCustomer: (state) => {},
  },
  actions: {
    async register({
      email,
      password,
      name,
      role = "bakery_admin",
      bakeryId = null,
    }) {
      this.loading = true;
      this.error = null;

      try {
        // 1. Validate input
        if (!email || !password || !name) {
          throw new Error("Email, password, and name are required");
        }

        // 2. Send registration request to your backend API
        const response = await axios.post(`${API_URL}/auth/register`, {
          email,
          password,
          name,
          role,
          bakeryId,
        });

        console.log("response", response);

        // 3. Update store state
        this.uid = response.data.user.uid;
        this.user = {
          uid: response.data.user.uid,
          email,
          name,
          role,
          bakeryId,
        };

        return {
          success: true,
          user: this.user,
        };
      } catch (error) {
        console.error("Registration error:", error);
        this.error = error.message || "Registration failed";

        // If Firebase user was created but backend failed, we should clean up
        if (this.user) {
          try {
            await this.user.delete();
          } catch (cleanupError) {
            console.error("Error cleaning up Firebase user:", cleanupError);
          }
        }

        throw error;
      } finally {
        this.loading = false;
      }
    },

    async login({ email, password }) {
      this.loading = true;
      this.error = null;

      try {
        // 1. Firebase Authentication
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        const user = userCredential.user;

        // 2. Get ID token for backend authentication
        const idToken = await user.getIdToken(true);

        // 3. Authenticate with your backend
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

          console.log("Login response", response);

          // 4. Set user data from backend response
          const userData = response.data;
          this.user = {
            uid: user.uid,
            email: user.email,
            ...userData, // This should include role, name, bakeryId, etc.
          };
          this.uid = user.uid;
        } catch (backendError) {
          console.error("Backend login failed:", backendError);
          // If backend auth fails, sign out from Firebase
          await signOut(auth);
          throw new Error(
            backendError.response?.data?.error ||
              "Backend authentication failed"
          );
        }

        // 5. Store tokens and user info
        this.idToken = idToken;
        localStorage.setItem("AuthToken", idToken);
        localStorage.setItem("email", email);

        return {
          success: true,
          user: this.user,
        };
      } catch (error) {
        console.error("Login error:", error);

        // Handle specific Firebase auth errors
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
      await signOut(auth)
        .then((res) => {
          this.user = null;
          this.userData = null;
          this.idToken = null;
          localStorage.setItem("AuthToken", null);
          localStorage.setItem("email", null);
          console.log(res);
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          console.log(errorCode, errorMessage);
        });
    },

    async checkAuth() {
      await onAuthStateChanged(auth, (user) => {
        if (user) {
          // User is signed in, see docs for a list of available properties
          // https://firebase.google.com/docs/reference/js/firebase.User
          user.getIdToken(true).then((idToken) => {
            localStorage.setItem("AuthToken", user.accessToken);
            localStorage.setItem("email", user.email);
            this.user = user;
            this.idToken = idToken;
            console.log("logged in");
          });
          getUserData(user.uid).then((e) => {
            console.log(e);
            this.userData = e;
          });

          // ...
        } else {
          this.user = null;
          this.idToken = null;
          console.log("logged out");
        }
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
