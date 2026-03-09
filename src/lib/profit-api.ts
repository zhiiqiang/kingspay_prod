import { apiFetch } from './api';

export interface ProfitEntry {
  id: number;
  idMerchant: number | null;
  idAgent: number | null;
  entryType: string;
  balanceBefore: number;
  balanceAfter: number;
  amount: number;
  referenceType: string;
  idReference: string;
  created_at: string;
  created_by: string;
}

export interface ProfitDataRequest {
  page?: number;
  limit?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
}

export interface ProfitDataResponse {
  status: boolean;
  message?: string;
  balance: number;
  data: ProfitEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface WithdrawHistoryEntry {
  id: number;
  idMerchant: number | null;
  merchantName: string | null;
  idAgent: number | null;
  agentName: string | null;
  idChannel: number;
  channelName: string;
  merchantTrxId: string;
  platformTrxId: string;
  partnerTrxId: string | null;
  accountNo: string;
  accountName: string;
  bankCode: string;
  amount: number;
  biayaChannel: number | null;
  biayaPlatform: number | null;
  biayaAgent: number | null;
  status: string;
  created_at: string;
  success_at: string | null;
}

export interface WithdrawHistoryRequest {
  page?: number;
  limit?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
}

export interface WithdrawHistoryResponse {
  status: boolean;
  message?: string;
  data: WithdrawHistoryEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface InquiryRequest {
  bankCode: string;
  accountNo: string;
  amount: number;
}

export interface InquiryResponse {
  status: boolean;
  message?: string;
  data: {
    merchantTrxId: string;
    platformTrxId: string;
    accountNo: string;
    accountName: string;
    bankCode: string;
    amount: number;
  };
}

export interface TransferRequest {
  platformTrxId: string;
  accountNo: string;
  accountName: string;
  bankCode: string;
  amount: number;
  password: string;
}

export interface TransferResponse {
  status: boolean;
  message?: string;
}

export async function fetchProfitData(body: ProfitDataRequest) {
  return apiFetch<ProfitDataResponse>('profit/data', { method: 'POST', body });
}

export async function fetchWithdrawHistory(body: WithdrawHistoryRequest) {
  return apiFetch<WithdrawHistoryResponse>('profit/withdraw/history', {
    method: 'POST',
    body,
  });
}

export async function inquiryWithdraw(body: InquiryRequest) {
  return apiFetch<InquiryResponse>('profit/withdraw/inquiry', {
    method: 'POST',
    body,
  });
}

export async function transferWithdraw(body: TransferRequest) {
  return apiFetch<TransferResponse>('profit/withdraw/transfer', {
    method: 'POST',
    body,
  });
}
