import React, { createContext, useContext, useState, useEffect } from 'react';
import mandiApi from '../services/mandiApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('agrinexa_auth_token'));
  const [loading, setLoading] = useState(true);

  // Load user profile on mount if token is present
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const userData = await mandiApi.getMe();
        setUser(userData);
      } catch (err) {
        console.warn('Failed to restore session:', err);
        // Token invalid or expired
        localStorage.removeItem('agrinexa_auth_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const login = async (identifier, password, rememberMe = false) => {
    const res = await mandiApi.login({
      identifier,
      password,
      remember_me: rememberMe
    });
    localStorage.setItem('agrinexa_auth_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res;
  };

  const signup = async (formData) => {
    const res = await mandiApi.signup(formData);
    localStorage.setItem('agrinexa_auth_token', res.access_token);
    setToken(res.access_token);
    setUser(res.user);
    return res;
  };

  const logout = async () => {
    try {
      await mandiApi.logout();
    } catch (e) {
      // ignore network errors on logout
    }
    localStorage.removeItem('agrinexa_auth_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const userData = await mandiApi.getMe();
      setUser(userData);
    } catch (err) {
      console.warn('Failed to refresh user:', err);
    }
  };

  const loginAsDemoFarmer = async () => {
    return login('9876543210', 'Farmer@123', true);
  };

  const loginAsDemoAdmin = async () => {
    return login('admin@agrinexa.in', 'Admin@123', true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin' || user?.role === 'reviewer',
        login,
        signup,
        logout,
        refreshUser,
        loginAsDemoFarmer,
        loginAsDemoAdmin,
      }}
    >
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

export default AuthContext;

