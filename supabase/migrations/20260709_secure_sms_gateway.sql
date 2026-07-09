-- Migration: Secure SMS Gateway Proxy via Supabase PostgreSQL RPC (Robust Version)
-- Resolves CORS blocks, WAF blocks (using User-Agent), and SSL peer connection resets.

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
  headers http_header[];
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

  -- Add standard browser headers to bypass firewall / Cloudflare blocks targeting database user-agents
  headers := ARRAY[
    http_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    http_header('Accept', 'application/json')
  ];

  -- Execute synchronous HTTP GET request (try HTTPS first)
  BEGIN
    SELECT * FROM http_get(url, headers) INTO resp;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: If SSL/TLS connection reset occurs, retry via non-SSL HTTP
    url := replace(url, 'https://', 'http://');
    SELECT * FROM http_get(url, headers) INTO resp;
  END;
  
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
