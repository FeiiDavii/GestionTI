import axios from 'axios';
import Swal from 'sweetalert2';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

// El manejo de sesión expirada se hace desde AuthContext, no desde el interceptor
// para evitar ciclos con React StrictMode
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  permisos: () => api.get('/auth/permisos'),
  recovery: (username) => api.post('/auth/recovery', { username }),
  changePassword: (data) => api.post('/auth/change-password', data),
  profileStats: () => api.get('/auth/profile-stats'),
};

export const dashboardAPI = {
  data: () => api.get('/dashboard/data'),
  config: () => api.get('/dashboard/config'),
  saveConfig: (config) => api.post('/dashboard/config', config),
  slaStats: () => api.get('/dashboard/sla-stats')
};

// Helper: send FormData without the JSON Content-Type header
const postFormData = (url, data) =>
  axios.post('/api' + url, data, {
    withCredentials: true
  });

export const ticketAPI = {
  myTickets: () => api.get('/tickets/my'),
  allTickets: () => api.get('/tickets/all'),
  detail: (id) => api.get(`/tickets/detail?id=${id}`),
  create: (data) => postFormData('/tickets/create', data),
  reply: (data) => api.post('/tickets/reply', data),
  update: (data) => api.post('/tickets/update', data),
  escalate: (data) => api.post('/tickets/escalate', data),
  rate: (data) => api.post('/tickets/rate', data),
  reopen: (data) => api.post('/tickets/reopen', data),
  timeline: (id) => api.get(`/tickets/timeline?id=${id}`),
  chatUsers: () => api.get('/tickets/chat-users')
};

export const equipmentAPI = {
  list: () => api.get('/equipments'),
  get: (id) => api.get(`/equipments/${id}`),
  listas: () => api.get('/equipments/listas'),
  create: (data) => api.post('/equipments/create', data),
  update: (data) => api.post('/equipments/update', data),
  delete: (id, table_target) => api.post('/equipments/delete', { id, table_target }),
  totales: () => api.get('/equipments/totales')
};

export const maintenanceAPI = {
  list: () => api.get('/maintenance/list'),
  detail: (id) => api.get(`/maintenance/detail?id=${id}`),
  save: (data) => api.post('/maintenance/save', data),
  update: (data) => api.post('/maintenance/update', data)
};

export const licenseAPI = {
  list: () => api.get('/licenses'),
  listas: () => api.get('/licenses/listas'),
  create: (data) => api.post('/licenses/create', data),
  update: (data) => api.post('/licenses/update', data),
  delete: (id) => api.post('/licenses/delete', { id })
};

export const assignmentAPI = {
  list: () => api.get('/assignments'),
  asignaciones: () => api.get('/assignments/asignaciones'),
  save: (data) => api.post('/assignments/save', data),
  asignar: (data) => api.post('/assignments/asignar', data),
  editAsignacion: (data) => api.post('/assignments/edit-asignacion', data),
  deleteAsignacion: (id) => api.post('/assignments/delete-asignacion', { id })
};

export const bajasAPI = {
  search: (q) => api.get(`/bajas/search?q=${q}`),
  save: (data) => api.post('/bajas/save', data),
  list: () => api.get('/bajas/list'),
  consolidated: () => api.get('/bajas/consolidated')
};

export const notificationAPI = {
  list: () => api.get('/notifications'),
  send: (data) => api.post('/notifications/send', data),
  markRead: (id) => api.post('/notifications/mark-read', { id }),
  markReadByRelated: (data) => api.post('/notifications/mark-read-by-related', data)
};

export const reportAPI = {
  generate: (data) => api.post('/reports/generate', data),
  listas: () => api.get('/reports/listas')
};

export const searchAPI = {
  global: (q) => api.get(`/search/global?q=${q}`)
};

export const auxAPI = {
  save: (data) => api.post('/aux/save', data),
  areas: () => api.get('/aux/areas'),
  marcas: () => api.get('/aux/marcas'),
  tipos: () => api.get('/aux/tipos'),
  configuraciones: () => api.get('/aux/configuraciones'),
  hardwareConfigs: () => api.get('/aux/hardware-configs'),
  funcionarios: () => api.get('/aux/funcionarios'),
  users: () => api.get('/aux/users'),
  saveUser: (data) => api.post('/aux/users/save', data),
  toggleStatus: (data) => api.post('/aux/users/toggle-status', data),
  forceLogout: (data) => api.post('/aux/users/force-logout', data)
};

export const permissionAPI = {
  roles: () => api.get('/permissions/roles'),
  saveRole: (data) => api.post('/permissions/roles/save', data),
  deleteRole: (id) => api.post('/permissions/delete-role', { id }),
  configSLA: () => api.get('/permissions/config-sla'),
  saveSLA: (data) => api.post('/permissions/save-sla', data),
  deleteSLA: (id) => api.post('/permissions/delete-sla', { id }),
  keywords: () => api.get('/permissions/keywords'),
  saveKeyword: (data) => api.post('/permissions/save-keyword', data),
  deleteKeyword: (id) => api.post('/permissions/delete-keyword', { id }),
  logs: () => api.get('/permissions/logs'),
  clearLogs: () => api.post('/permissions/clear-logs'),
  importBackup: (formData) => axios.post('/api/permissions/import-backup', formData, { withCredentials: true }),
};

export default api;
