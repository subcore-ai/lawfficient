-- RBAC audit (spec 25, FR-rbac-9): role / permission / assignment changes are
-- audit-logged, like the user-management changes in 0006+. The audit_entity enum
-- (0002) predates RBAC, so add 'role' as a loggable entity. ADD VALUE only appends
-- the label (no rewrite) and is safe in the migration transaction because nothing
-- here uses the new value yet.
alter type public.audit_entity add value if not exists 'role';
