-- Website enquiries are leads attached to the same canonical customer record.
CREATE TABLE IF NOT EXISTS rr_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_number text NOT NULL UNIQUE,
 customer_id uuid NOT NULL REFERENCES rr_customers(id),
 project_id uuid REFERENCES rr_projects(id),
 source text NOT NULL DEFAULT 'website',
 requirement text NOT NULL,
 budget_min_minor bigint,
 budget_max_minor bigint,
 preferred_timeline text,
 status text NOT NULL DEFAULT 'new_enquiry',
 consent_to_contact boolean NOT NULL DEFAULT false,
 idempotency_key text NOT NULL UNIQUE,
 first_response_at timestamptz,
 lost_reason text,
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 created_by text NOT NULL DEFAULT 'website',
 version integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS rr_leads_customer_idx ON rr_leads(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rr_leads_status_idx ON rr_leads(status, created_at DESC);
