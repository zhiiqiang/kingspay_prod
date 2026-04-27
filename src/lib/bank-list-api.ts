import { apiFetch } from './api';

export interface BankListItem {
  id: number;
  code: string;
  name: string;
  status: 'active' | 'inactive' | string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BankListResponse {
  status: boolean;
  message?: string;
  data: BankListItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface FetchBankListRequest {
  page?: number;
  limit?: number;
  code?: string;
  status?: string;
}

export async function fetchBankList(params: FetchBankListRequest) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.code?.trim()) searchParams.set('code', params.code.trim());
  if (params.status?.trim()) searchParams.set('status', params.status.trim());

  return apiFetch<BankListResponse>(`bank-list?${searchParams.toString()}`, {
    method: 'GET',
  });
}
