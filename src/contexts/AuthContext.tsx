import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  email: string;
  role: 'student' | 'admin';
  name?: string;
  branch?: string;
  year?: string;
  department?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check sessionStorage for token (instead of localStorage)
    const storedToken = sessionStorage.getItem('token');
    if (storedToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
            setToken(storedToken);
          } else {
            sessionStorage.removeItem('token');
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    sessionStorage.setItem('token', data.token); // Use sessionStorage
    setToken(data.token);
    setUser(data.user);
    navigate(data.user.role === 'admin' ? '/admin' : '/');
  };

  const logout = () => {
    sessionStorage.removeItem('token'); // Clear sessionStorage
    setUser(null);
    setToken(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};