import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Layout from './components/Layout';
import DisplaySettings from './components/DisplaySettings';
import { applyUserPreferences } from './userPreferences';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    applyUserPreferences();
  }, []);

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

  return (
    <>
      {!user || !token ? (
        <Auth onLogin={handleLogin} />
      ) : (
        <Layout user={user} token={token} onLogout={handleLogout} />
      )}
      <DisplaySettings />
    </>
  );
}
