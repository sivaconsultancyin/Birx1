-- Production audit trail and operational health metadata
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NULL,
  action TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  request_id TEXT NULL,
  ip_hash TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx ON public.audit_logs(user_id, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_no_client_access ON public.audit_logs;
CREATE POLICY audit_logs_no_client_access ON public.audit_logs
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_user_id TEXT,
  p_action TEXT,
  p_method TEXT,
  p_path TEXT,
  p_status_code INTEGER,
  p_request_id TEXT DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(user_id, action, method, path, status_code, request_id, ip_hash, metadata)
  VALUES(p_user_id, p_action, p_method, p_path, p_status_code, p_request_id, p_ip_hash, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_log(text,text,text,text,integer,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(text,text,text,text,integer,text,text,jsonb) TO service_role;

-- Operational health checks must not expose database credentials or internal state.
