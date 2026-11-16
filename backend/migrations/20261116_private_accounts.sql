-- Run once in the Supabase SQL Editor. Existing rows are preserved.
-- Clerk authenticates requests to Express, not to Supabase. Browser clients
-- therefore must NOT have direct access to these private tables. The backend
-- uses service_role, which bypasses RLS and applies account checks itself.
BEGIN;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_validators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on users" ON public.users;
DROP POLICY IF EXISTS "Service role full access on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role full access on task_validators" ON public.task_validators;
DROP POLICY IF EXISTS "Service role full access on ai_analyses" ON public.ai_analyses;
REVOKE ALL ON public.users, public.notifications, public.task_validators, public.ai_analyses FROM anon, authenticated;
GRANT ALL ON public.users, public.notifications, public.task_validators, public.ai_analyses TO service_role;
COMMIT;
-- No permissive client policies are needed. All app reads/writes use the API.
-- Notifications use authenticated API polling, not anonymous Realtime access.
