import { apiFetch } from './api';

export interface BankAccountItem {
  id: number;
  bankCode: string;
  accountNo: string;
  accountName: string;
  idMerchant: number | null;
  idAgent: number | null;
  idAdmin: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface BankAccountListRequest {
  page?: number;
  limit?: number;
  keyword?: string;
}

export interface BankAccountListResponse {
  status: boolean;
  message?: string;
  data: BankAccountItem[];
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}

export interface BankAccountDetailResponse {
  status: boolean;
  message?: string;
  data: BankAccountItem;
}

export interface ApiMessageResponse {
  status: boolean;
  message?: string;
}

export async function fetchBankAccounts(params: BankAccountListRequest) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.keyword?.trim()) searchParams.set('keyword', params.keyword.trim());

  return apiFetch<BankAccountListResponse>(`data-rekening?${searchParams.toString()}`, {
    method: 'GET',
  });
}

export async function fetchBankAccountById(id: number) {
  return apiFetch<BankAccountDetailResponse>(`data-rekening/${id}`, { method: 'GET' });
}

export async function createBankAccount(body: { bankCode: string; accountNo: string; accountName: string }) {
  return apiFetch<ApiMessageResponse>('data-rekening/add', {
    method: 'POST',
    body,
  });
}

export async function updateBankAccount(id: number, body: { bankCode: string; accountNo: string; accountName: string }) {
  return apiFetch<ApiMessageResponse>(`data-rekening/update/${id}`, {
    method: 'POST',
    body,
  });
}
