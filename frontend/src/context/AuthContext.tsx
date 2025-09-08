import { createContext, useState, useContext, FC, PropsWithChildren, useEffect } from 'react';
import * as authService from '@/services/auth.service';
import { setGlobalLogoutHandler } from '@/services/api.service';
import { LoginCredentials } from '@/types';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  checkAuthStatus: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 10000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return true;
  }
};

export const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      if (isTokenExpired(storedToken)) {
        console.log('JWT token expired, logging out');
        logout();
      } else {
        setToken(storedToken);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkAuthStatus();
    setGlobalLogoutHandler(logout);
    
    const tokenCheckInterval = setInterval(() => {
      const storedToken = localStorage.getItem('token');
      if (storedToken && isTokenExpired(storedToken)) {
        console.log('JWT token expired during periodic check, logging out');
        logout();
      }
    }, 30000);

    return () => {
      clearInterval(tokenCheckInterval);
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const { accessToken } = await authService.login(credentials);
    setToken(accessToken);
    localStorage.setItem('token', accessToken);
  };

  const register = async (credentials: LoginCredentials) => {
    await authService.register(credentials);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    // Redirect to login page on logout
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      token, 
      isAuthenticated: !!token, 
      isLoading, 
      login, 
      register, 
      logout,
      checkAuthStatus 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

