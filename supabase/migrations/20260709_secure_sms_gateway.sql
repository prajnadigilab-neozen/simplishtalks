-- Migration: Secure SMS Gateway Proxy via Supabase PostgreSQL RPC
-- Uses plain HTTP (not HTTPS) for smsgatewayhub.com which does not support TLS.

-- 1. Enable http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http;

-- 2. Drop old version to ensure a clean replacement
DROP FUNCTION IF EXISTS public.send_sms_via_gateway(text, text, text, text, text, text, text);

-- 3. Create the SMS Gateway Proxy function using plain HTTP
CREATE OR REPLACE FUNCTION public.send_sms_via_gateway(
  phone text,
  message text,
  template_id text,
  peid text,
  api_key text,
  sender_id text,
  channel text
) RETURNS jsonb SECURITY DEFINER AS $$
DECLARE
  url text;
  resp http_response;
  resp_content jsonb;
BEGIN
  -- NOTE: smsgatewayhub.com does NOT support HTTPS on their API endpoint.
  -- Using plain http:// here is intentional and required for the connection to succeed.
  url := 'http://login.smsgatewayhub.com/api/mt/SendSMS?APIKey=' || urlencode(api_key) ||
         '&senderid=' || urlencode(sender_id) ||
         '&channel=' || urlencode(channel) ||
         '&DCS=0&flashsms=0&number=91' || phone ||
         '&text=' || urlencode(message);

  if peid is not null and peid <> '' then
    url := url || '&EntityId=' || urlencode(peid);
  end if;
  if template_id is not null and template_id <> '' then
    url := url || '&dlttemplateid=' || urlencode(template_id);
  end if;

  -- Use http_request composite type with User-Agent header
  SELECT * INTO resp FROM http((
    'GET'::http_method,
    url,
    ARRAY[
      http_header('User-Agent', 'Mozilla/5.0 (compatible; SimplishOTP/1.0)'),
      http_header('Accept', 'application/json')
    ],
    NULL::text,
    NULL::text
  )::http_request);

  -- Parse JSON response safely
  BEGIN
    resp_content := resp.content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    resp_content := jsonb_build_object('raw_response', resp.content);
  END;

  RETURN jsonb_build_object(
    'success', (resp.status = 200),
    'status', resp.status,
    'content', resp_content
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- 4. Grant access to execute this RPC from the frontend (unauthenticated during registration)
GRANT EXECUTE ON FUNCTION public.send_sms_via_gateway(text, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.send_sms_via_gateway(text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_sms_via_gateway(text, text, text, text, text, text, text) TO service_role;
