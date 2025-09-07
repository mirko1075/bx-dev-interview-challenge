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
    console.log('🔍 UPLOAD DEBUG - Starting upload');
    console.log('📁 File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });
    console.log('🔗 Upload URL:', url);
    
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', url);
    
    console.log('📤 XHR opened with PUT method');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded * 100) / event.total);
        onProgress(percentComplete);
        console.log(`📊 Upload progress: ${percentComplete}%`);
      }
    };

    xhr.onload = () => {
      console.log('✅ XHR onload triggered');
      console.log('📋 Response status:', xhr.status);
      console.log('📋 Response statusText:', xhr.statusText);
      console.log('📋 Response headers:', xhr.getAllResponseHeaders());
      console.log('📋 Response body:', xhr.responseText);
      
      if (xhr.status >= 200 && xhr.status < 300) {
        console.log('✅ Upload successful!');
        resolve();
      } else {
        console.log('❌ Upload failed with status:', xhr.status);
        reject(new Error(`Upload failed with status: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      console.log('❌ XHR error occurred');
      reject(new Error('An error occurred during the upload.'));
    };

    const urlParams = new URLSearchParams(url.split('?')[1]);
    const expectedContentType = urlParams.get('Content-Type');
    
    if (expectedContentType) {
      xhr.setRequestHeader('Content-Type', expectedContentType);
      console.log('📋 Set Content-Type header to match signature:', expectedContentType);
    } else {
      xhr.setRequestHeader('Content-Type', file.type);
      console.log('📋 Set Content-Type header to file type:', file.type);
    }
    
    console.log('📤 Sending file data...');
    xhr.send(file);
  });
};

