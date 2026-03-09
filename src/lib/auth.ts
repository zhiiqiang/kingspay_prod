export type UserRole = 'admin';

const USER_ROLE_STORAGE_KEY = 'kp-user-role';
const AUTH_TOKEN_STORAGE_KEY = 'kp-auth-token';
const USER_PERMISSIONS_STORAGE_KEY = 'kp-user-permissions';
const USER_NAME_STORAGE_KEY = 'kp-user-name';

export const persistUserRole = (role: UserRole) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(USER_ROLE_STORAGE_KEY, role);
};

export const getStoredUserRole = (): UserRole | null => {
  if (typeof window === 'undefined') return null;

  const storedRole = window.localStorage.getItem(USER_ROLE_STORAGE_KEY);
  return storedRole === 'admin' ? storedRole : null;
};

export const clearStoredUserRole = () => {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(USER_ROLE_STORAGE_KEY);
};

export const persistAuthToken = (token: string) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
};

export const persistUserPermissions = (
  permissions: string | string[] | null | undefined,
) => {
  if (typeof window === 'undefined') return;

  if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) {
    window.localStorage.removeItem(USER_PERMISSIONS_STORAGE_KEY);
    return;
  }

  const value = Array.isArray(permissions) ? permissions.join(',') : permissions;
  window.localStorage.setItem(USER_PERMISSIONS_STORAGE_KEY, value);
};

export const persistUserName = (name: string | null | undefined) => {
  if (typeof window === 'undefined') return;

  if (!name) {
    window.localStorage.removeItem(USER_NAME_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(USER_NAME_STORAGE_KEY, name);
};

export const getStoredUserName = (): string | null => {
  if (typeof window === 'undefined') return null;

  return window.localStorage.getItem(USER_NAME_STORAGE_KEY);
};

export const getStoredAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
};

export const clearStoredAuthToken = () => {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

export const getStoredUserPermissions = (): string[] => {
  if (typeof window === 'undefined') return [];

  const storedPermissions = window.localStorage.getItem(USER_PERMISSIONS_STORAGE_KEY);
  if (!storedPermissions) return [];

  return storedPermissions
    .split(',')
    .map((permission) => permission.trim())
    .filter(Boolean);
};

export const clearStoredUserPermissions = () => {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(USER_PERMISSIONS_STORAGE_KEY);
};

export const clearStoredUserName = () => {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(USER_NAME_STORAGE_KEY);
};
