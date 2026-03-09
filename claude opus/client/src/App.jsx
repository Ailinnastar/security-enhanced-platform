import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Layout from './components/Layout';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('sg_user');
    const savedToken = localStorage.getItem('sg_token');
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setToken(savedToken);
    }
  }, []);

  function handleLogin(userData, authToken) {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('sg_user', JSON.stringify(userData));
    localStorage.setItem('sg_token', authToken);
  }

  function handleLogout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('sg_user');
    localStorage.removeItem('sg_token');
  }

  if (!user || !token) return <Auth onLogin={handleLogin} />;
  return <Layout user={user} token={token} onLogout={handleLogout} />;
}
