const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
    throw new Error('Nicht autorisiert');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
}

export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),

  // Users
  getUsers: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),

  // Items
  getItems: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/items${qs ? '?' + qs : ''}`);
  },
  getItem: (id) => request(`/items/${id}`),
  getCategories: () => request('/items/categories'),
  createItem: (data) => request('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id, data) => request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),

  // Reservations
  getReservations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reservations${qs ? '?' + qs : ''}`);
  },
  getMyReservations: () => request('/reservations/my'),
  createReservation: (data) => request('/reservations', { method: 'POST', body: JSON.stringify(data) }),
  cancelReservation: (id) => request(`/reservations/${id}/cancel`, { method: 'PUT' }),
  deleteReservation: (id) => request(`/reservations/${id}`, { method: 'DELETE' }),
};
