    import axios from 'axios';

    const api = axios.create({
      baseURL: '/api', // The base URL for our backend
    });

    /**
     * This is an interceptor. It runs before every single request.
     * Here, we check if we have a token in localStorage. If we do,
     * we add it to the Authorization header.
     */
    api.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    export default api;
    
