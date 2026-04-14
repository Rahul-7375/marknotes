import axios from 'axios';

// In dev: proxy forwards /api → localhost:5000
// In prod: same server serves both /api and the React build
const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.errors?.[0]?.msg ||
      err.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export const notesApi = {
  getAll:         (params = {}) => client.get('/notes', { params }),
  getOne:         (id)          => client.get(`/notes/${id}`),
  create:         (data)        => client.post('/notes', data),
  update:         (id, data)    => client.put(`/notes/${id}`, data),
  delete:         (id)          => client.delete(`/notes/${id}`),
  getVersions:    (id)          => client.get(`/notes/${id}/versions`),
  restoreVersion: (nId, vId)    => client.post(`/notes/${nId}/restore/${vId}`),
};

export const tagsApi = {
  getAll: () => client.get('/tags'),
};

export default client;
