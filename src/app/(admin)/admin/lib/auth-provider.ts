"use client";

import { AuthProvider } from "@refinedev/core";

export const createAuthProvider = (
  clerk: any, 
  session: any, 
  user: any
): AuthProvider => {
  return {
    login: async () => {
      // Clerk handles this via middleware/UI
      return { success: true };
    },
    logout: async () => {
      await clerk.signOut();
      return { success: true, redirectTo: "/" };
    },
    check: async () => {
      if (session) {
        return { authenticated: true };
      }
      return { authenticated: false, redirectTo: "/sign-in" };
    },
    getIdentity: async () => {
      if (user) {
        return {
          id: user.id,
          name: user.fullName,
          avatar: user.imageUrl,
          email: user.primaryEmailAddress?.emailAddress,
        };
      }
      return null;
    },
    getPermissions: async () => {
      const role = session?.publicMetadata?.role;
      return role || null;
    },
    onError: async (error) => {
      if (error.statusCode === 401 || error.statusCode === 403) {
        return { logout: true };
      }
      return { error };
    },
  };
};
