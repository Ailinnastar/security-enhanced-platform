const API_URL = (window.__API_URL || 'http://localhost:3001') + '/api';

export default async function api(endpoint, options = {}, token) {
  const geminiKey = (() => {
    try {
      return localStorage.getItem('sg_gemini_api_key') || '';
    } catch {
      return '';
    }
  })();

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(geminiKey.trim() ? { 'X-Gemini-Api-Key': geminiKey.trim() } : {}),
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
