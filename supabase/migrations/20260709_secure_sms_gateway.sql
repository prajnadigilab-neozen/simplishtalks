-- Migration: Secure SMS Gateway Proxy via Supabase PostgreSQL RPC
-- Resolves CORS blocks and net::ERR_CONNECTION_RESET from client-side browsers.

-- 1. Enable http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http;

-- 2. Create the SMS Gateway Proxy function
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
  resp record;
  resp_content jsonb;
BEGIN
  -- Construct the SMSGateWayHub URL with URL-encoded query parameters
  url := 'https://login.smsgatewayhub.com/api/mt/SendSMS?APIKey=' || urlencode(api_key) ||
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

  -- Execute synchronous HTTP GET request
  SELECT * FROM http_get(url) INTO resp;
  
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

-- 3. Grant public access to execute this RPC (accessible from client-side anonymously for registration)
GRANT EXECUTE ON FUNCTION public.send_sms_via_gateway(text, text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.send_sms_via_gateway(text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_sms_via_gateway(text, text, text, text, text, text, text) TO service_role;
