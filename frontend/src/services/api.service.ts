type ProgressCallback = (progress: number) => void;

type FetchOptions = RequestInit;

const customFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || 'An error occurred');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions): Promise<T> => customFetch(endpoint, { ...options, method: 'GET' }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T>(endpoint: string, body: any, options?: FetchOptions): Promise<T> =>
    customFetch(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: <T>(endpoint: string, body: any, options?: FetchOptions): Promise<T> =>
    customFetch(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, options?: FetchOptions): Promise<T> => customFetch(endpoint, { ...options, method: 'DELETE' }),
};


export const uploadWithProgress = (url: string, file: File, onProgress: ProgressCallback): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded * 100) / event.total);
        onProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('An error occurred during the upload.'));
    };

    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
};

