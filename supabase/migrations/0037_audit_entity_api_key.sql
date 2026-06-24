-- Audit the public-API key lifecycle (create / enable / disable / delete) from the Settings →
-- Integrations management UI. Extends the audit_entity enum, exactly as 'role' (0010), 'lead_source'
-- (0021), and 'taxonomy' (0024) did. Adding the value only (it isn't USED in this migration's
-- transaction) is safe on PG12+.
alter type public.audit_entity add value if not exists 'api_key';
