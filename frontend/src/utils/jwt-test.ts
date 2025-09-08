export const createExpiredToken = (): string => {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    sub: 'test-user',
    iat: Math.floor(Date.now() / 1000) - 3600,
    exp: Math.floor(Date.now() / 1000) - 1800
  };

  const signature = 'fake-signature';

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const createValidToken = (expiresInMinutes: number = 60): string => {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    sub: 'test-user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (expiresInMinutes * 60)
  };

  const signature = 'fake-signature';

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export const simulateExpiredToken = () => {
  const expiredToken = createExpiredToken();
  localStorage.setItem('token', expiredToken);
  console.log('Set expired token in localStorage:', expiredToken);
};

export const simulateValidToken = (expiresInMinutes: number = 60) => {
  const validToken = createValidToken(expiresInMinutes);
  localStorage.setItem('token', validToken);
  console.log('Set valid token in localStorage:', validToken);
};
