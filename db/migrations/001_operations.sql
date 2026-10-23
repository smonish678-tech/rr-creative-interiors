-- RR Creative Interiors operations schema. Apply once to Neon PostgreSQL connected via DATABASE_URL.
-- Monetary values are integer paise; never use floating point for money.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS rr_customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL, normalized_name text NOT NULL,
 primary_email text, normalized_email text, primary_phone text, normalized_phone text,
 communication_preference text NOT NULL DEFAULT 'whatsapp' CHECK (communication_preference IN ('whatsapp','email','phone','none')),
 consent_at timestamptz, notes text NOT NULL DEFAULT '', archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS rr_customers_email_idx ON rr_customers(normalized_email) WHERE normalized_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS rr_customers_phone_idx ON rr_customers(normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE TABLE IF NOT EXISTS rr_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES rr_customers(id), name text NOT NULL,
 role text NOT NULL DEFAULT 'other', email text, phone text, is_primary boolean NOT NULL DEFAULT false,
 can_approve boolean NOT NULL DEFAULT false, can_receive_finance_documents boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS rr_contacts_customer_idx ON rr_contacts(customer_id);
CREATE TABLE IF NOT EXISTS rr_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES rr_customers(id), lead_id text,
 project_code text NOT NULL UNIQUE, name text NOT NULL, project_type text NOT NULL DEFAULT 'residential',
 address text NOT NULL DEFAULT '', apartment text NOT NULL DEFAULT '', floor text NOT NULL DEFAULT '', possession_date date,
 site_ready boolean, stage text NOT NULL DEFAULT 'booking', owner_id text NOT NULL DEFAULT 'admin', designer_id text,
 estimated_budget_minor bigint, currency char(3) NOT NULL DEFAULT 'INR', target_start_date date, committed_handover_date date,
 delivery_clock_started_at timestamptz, delivery_clock_paused_at timestamptz, hold_reason text, closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS rr_projects_customer_idx ON rr_projects(customer_id);
CREATE INDEX IF NOT EXISTS rr_projects_stage_idx ON rr_projects(stage);
CREATE TABLE IF NOT EXISTS rr_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES rr_projects(id), quote_number text NOT NULL,
 revision integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'draft', lines jsonb NOT NULL DEFAULT '[]'::jsonb,
 subtotal_minor bigint NOT NULL DEFAULT 0, tax_minor bigint NOT NULL DEFAULT 0, total_minor bigint NOT NULL DEFAULT 0,
 currency char(3) NOT NULL DEFAULT 'INR', valid_until date, payment_policy_version_id text,
 exclusions jsonb NOT NULL DEFAULT '[]'::jsonb, assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
 issued_at timestamptz, accepted_at timestamptz, supersedes_quote_id uuid REFERENCES rr_quotes(id), document_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1,
 UNIQUE(project_id, quote_number, revision)
);
CREATE TABLE IF NOT EXISTS rr_payment_milestones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES rr_projects(id), quote_id uuid NOT NULL REFERENCES rr_quotes(id),
 label text NOT NULL, sequence integer NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor >= 0), due_at date,
 trigger text NOT NULL, status text NOT NULL DEFAULT 'not_due', waived_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1,
 UNIQUE(quote_id, sequence)
);
CREATE TABLE IF NOT EXISTS rr_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES rr_projects(id), customer_id uuid NOT NULL REFERENCES rr_customers(id),
 kind text NOT NULL, document_number text NOT NULL UNIQUE, version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'draft',
 title text NOT NULL, storage_path text, sha256 text, mime_type text NOT NULL DEFAULT 'text/html', source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
 issued_at timestamptz, signed_at timestamptz, supersedes_document_id uuid REFERENCES rr_documents(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin'
);
CREATE INDEX IF NOT EXISTS rr_documents_project_idx ON rr_documents(project_id, created_at DESC);
CREATE TABLE IF NOT EXISTS rr_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES rr_projects(id), milestone_id uuid REFERENCES rr_payment_milestones(id),
 direction text NOT NULL CHECK (direction IN ('in','out')), kind text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
 currency char(3) NOT NULL DEFAULT 'INR', method text NOT NULL, reference text, evidence_document_id uuid REFERENCES rr_documents(id),
 verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('unverified','verified','rejected')),
 verified_by text, verified_at timestamptz, idempotency_key text NOT NULL UNIQUE, notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS rr_transactions_project_idx ON rr_transactions(project_id, created_at DESC);
CREATE TABLE IF NOT EXISTS rr_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES rr_projects(id), document_id uuid NOT NULL REFERENCES rr_documents(id),
 approver_contact_id uuid REFERENCES rr_contacts(id), approver_name text NOT NULL, status text NOT NULL DEFAULT 'pending',
 decision text, requested_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, evidence_document_id uuid REFERENCES rr_documents(id), token_hash text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rr_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES rr_projects(id), customer_id uuid REFERENCES rr_customers(id),
 title text NOT NULL, description text NOT NULL DEFAULT '', owner_id text, due_at timestamptz, status text NOT NULL DEFAULT 'open',
 priority text NOT NULL DEFAULT 'normal', blocked_reason text, completed_at timestamptz, dedupe_key text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS rr_tasks_due_idx ON rr_tasks(status, due_at);
CREATE TABLE IF NOT EXISTS rr_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL, aggregate_type text NOT NULL, aggregate_id text NOT NULL,
 actor_id text NOT NULL DEFAULT 'admin', occurred_at timestamptz NOT NULL DEFAULT now(), idempotency_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb, delivery_state text NOT NULL DEFAULT 'pending', attempt_count integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rr_events_pending_idx ON rr_events(delivery_state, next_attempt_at);
CREATE TABLE IF NOT EXISTS rr_checklist_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES rr_projects(id), phase text NOT NULL,
 item_key text NOT NULL, label text NOT NULL, required boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'pending',
 evidence_document_id uuid REFERENCES rr_documents(id), checked_by text, checked_at timestamptz, notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1,
 UNIQUE(project_id, phase, item_key)
);
CREATE TABLE IF NOT EXISTS rr_warranties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES rr_projects(id), customer_id uuid NOT NULL REFERENCES rr_customers(id),
 certificate_document_id uuid REFERENCES rr_documents(id), invoice_document_id uuid REFERENCES rr_documents(id), joinery_start_date date, joinery_end_date date,
 policy_version text NOT NULL, status text NOT NULL DEFAULT 'draft', coverage_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rr_warranty_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), warranty_id uuid NOT NULL REFERENCES rr_warranties(id), project_id uuid NOT NULL REFERENCES rr_projects(id),
 customer_id uuid NOT NULL REFERENCES rr_customers(id), claim_number text NOT NULL UNIQUE, description text NOT NULL, category text NOT NULL,
 reported_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'received', owner_id text, next_action_at timestamptz, resolution text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rr_message_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES rr_projects(id), customer_id uuid NOT NULL REFERENCES rr_customers(id),
 channel text NOT NULL, template_key text NOT NULL, recipient text NOT NULL, rendered_subject text, rendered_body text NOT NULL,
 status text NOT NULL DEFAULT 'draft', idempotency_key text NOT NULL UNIQUE, attempt_count integer NOT NULL DEFAULT 0,
 last_attempt_at timestamptz, sent_at timestamptz, provider_message_id text, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL DEFAULT 'admin', version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rr_settings (
 setting_key text PRIMARY KEY, value jsonb NOT NULL, policy_version text NOT NULL, updated_by text NOT NULL DEFAULT 'admin', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rr_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text NOT NULL, action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL,
 before_state jsonb, after_state jsonb, reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rr_audit_entity_idx ON rr_audit_log(entity_type, entity_id, created_at DESC);
