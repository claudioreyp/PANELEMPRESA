export type AdminIdentity = {
  user_id: string;
  email: string | null;
  role: string;
  business_id: number | null;
  branch_id: number | null;
};

export type Business = {
  id: number;
  slug: string;
  name: string;
  status: "active" | "suspended";
  plan: string;
  currency: string;
  timezone: string;
  logo_url: string | null;
  phone: string | null;
  auto_accept_payment_evidence: boolean;
  auto_accept_limit: number;
  modules: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type AdminMetrics = {
  businesses: number;
  active_businesses: number;
  branches: number;
  orders_today: number;
  sales_today: number;
};

export type Branch = {
  id: number;
  business_id: number;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  opening_hours: Record<string, unknown>;
  accepted_payment_methods: string[];
  delivery_fee: number;
  yape_number: string | null;
  plin_number: string | null;
  payment_recipient_name: string | null;
  maps_url: string | null;
  yape_qr_storage_path?: string | null;
  yape_qr_configured?: boolean;
  menu_card_configured?: boolean;
  agent_context_notes?: string | null;
  active: boolean;
  delivery_enabled: boolean;
  takeaway_enabled: boolean;
};

export type IntegrationCredential = {
  id: number;
  business_id: number;
  branch_id: number;
  name: string;
  token_prefix: string;
  scopes: string[];
  active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  token?: string;
};

export type IntegrationEndpoint = {
  method: "GET" | "POST" | "PATCH";
  url: string;
  scope: string;
};

export type IntegrationPackage = {
  api_base_url: string;
  business_id: number;
  branch_id: number;
  authentication: "bearer";
  authorization_header: "Authorization";
  write_idempotency_header: "Idempotency-Key";
  scopes: string[];
  endpoints: Record<string, IntegrationEndpoint>;
};

export type RestaurantOnboardingResult = {
  business: Business;
  branch: Branch;
  owner_access: {
    user_id: string;
    email: string;
    full_name: string;
    role: "owner";
    status: "active";
    business_id: number;
    branch_id: null;
  };
  credential: IntegrationCredential & { token: string };
  integration: IntegrationPackage;
};

export type BusinessOverview = {
  business: Business;
  branches: number;
  users: number;
  orders: number;
  sales: number;
  pending_invitations: number;
  last_activity: string | null;
};

export type Invitation = {
  id: number;
  business_id: number;
  branch_id: number | null;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  delivery_status?: string;
  development_accept_url?: string;
};

export type Membership = {
  id: number;
  email: string | null;
  full_name: string;
  business_id: number;
  branch_id: number | null;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  can_reset_password?: boolean;
  password_security_version?: number;
  password_reset_required?: boolean;
  password_reset_operation_id?: string | null;
  identity_business_count?: number;
};

export type AuditEvent = {
  id: number;
  business_id: number | null;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};
