import axios from "axios";

const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 30000 // 30 second timeout
});

// Add authentication token to all requests
instance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor with retry logic for network errors
instance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;
        
        // Don't retry if we've already retried 3 times
        if (!config || !config.retry || config.retry >= 3) {
            return Promise.reject(error);
        }
        
        // Only retry on network errors or 5xx server errors
        const shouldRetry = 
            error.code === 'ERR_NETWORK' || 
            error.code === 'ERR_HTTP2_PROTOCOL_ERROR' ||
            error.code === 'ECONNABORTED' ||
            (error.response && error.response.status >= 500);
            
        if (!shouldRetry) {
            return Promise.reject(error);
        }
        
        // Initialize retry count
        config.retry = config.retry || 0;
        config.retry += 1;
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, config.retry - 1) * 1000;
        
        console.warn(`Retrying request (attempt ${config.retry}/3) after ${delay}ms:`, config.url);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return instance(config);
    }
);

export default instance;
