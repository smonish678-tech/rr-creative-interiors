CREATE UNIQUE INDEX IF NOT EXISTS rr_projects_lead_id_unique_idx ON rr_projects(lead_id) WHERE lead_id IS NOT NULL;
