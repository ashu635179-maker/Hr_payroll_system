import React, { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useGetMe, useLogin, useLogout, AuthUser, LoginBody, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: ReturnType<typeof useLogin>["mutateAsync"];
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);

  const { data, isLoading } = useGetMe({
    query: {
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false
    }
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    } else {
      setUser(null);
    }
  }, [data]);

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setUser(null);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    document.cookie = "lastLogin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    setLocation("/login");
  };

  const contextValue = {
    user,
    isLoading,
    login: async (body: any) => {
      const res = await loginMutation.mutateAsync(body);
      setUser(res.user);
      queryClient.setQueryData(getGetMeQueryKey(), res.user);
      return res;
    },
    logout: handleLogout,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
