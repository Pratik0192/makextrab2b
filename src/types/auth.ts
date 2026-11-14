export type UserRole =
  | "SUPER_ADMIN"
  | "SALES_MANAGER"
  | "SALES_EXECUTIVE"
  | "ACCOUNTS"
  | "INVENTORY"
  | "PURCHASE"
  | "HR_MANAGER"
  | "POS_CASHIER"
  | "EMPLOYEE"
  | "CUSTOMER";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  success: true;
  message: string;
  user: AuthenticatedUser;
}

export interface RegisterSuperAdminRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  setupSecret: string;
}

export interface RegisterSuperAdminResponse {
  success: true;
  message: string;
}

export interface AuthApiError {
  error: string;
  code?: string;
}
