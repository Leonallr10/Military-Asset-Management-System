export type Role = 'ADMIN' | 'BASE_COMMANDER' | 'LOGISTICS_OFFICER';
export type EquipmentType = 'VEHICLE' | 'WEAPON' | 'AMMUNITION' | 'OTHER';

export interface Base {
  id: string;
  name: string;
  code: string;
  location: string;
}

export interface Asset {
  id: string;
  name: string;
  equipmentType: EquipmentType;
  unit: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  rank?: string | null;
  role: Role;
  baseId: string | null;
  base?: Pick<Base, 'id' | 'name' | 'code'> | null;
}

export interface DashboardMetrics {
  filters: {
    baseId: string | null;
    equipmentType: string | null;
    dateFrom: string;
    dateTo: string;
  };
  metrics: {
    openingBalance: number;
    closingBalance: number;
    netMovement: number;
    purchases: number;
    transferIn: number;
    transferOut: number;
    assigned: number;
    expended: number;
  };
}

const TOKEN_KEY = 'mams_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  if (res.status === 204) {
    return undefined as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Request failed');
  }
  return data as T;
}
