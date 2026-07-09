import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * Supabase Edge Function: send-sms
 * Sends OTP via SMSGateWayHub API over HTTPS from Supabase edge network.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read credentials from Supabase Secrets
    const SMS_API_KEY = Deno.env.get('SMS_GATEWAY_API_KEY') ?? ''
    const SMS_SENDER_ID = Deno.env.get('SMS_GATEWAY_SENDER_ID') ?? 'SMPLSH'
    const SMS_CHANNEL = Deno.env.get('SMS_GATEWAY_CHANNEL') ?? '2'
    const SMS_PEID = Deno.env.get('SMS_GATEWAY_PEID') ?? ''
    const SMS_REGISTER_TEMPLATE_ID = Deno.env.get('SMS_GATEWAY_TEMPLATE_ID') ?? ''
    const SMS_RESET_TEMPLATE_ID = Deno.env.get('SMS_GATEWAY_RESET_TEMPLATE_ID') ?? ''

    // Validate secrets are configured
    if (!SMS_API_KEY) {
      console.error('[send-sms] SMS_GATEWAY_API_KEY secret is not set!')
      return jsonResponse({
        success: false,
        error: 'SMS service not configured. SMS_GATEWAY_API_KEY secret is missing.',
        debug: {
          hasApiKey: false,
          hasSenderId: !!SMS_SENDER_ID,
          hasChannel: !!SMS_CHANNEL,
          hasPeid: !!SMS_PEID,
          hasTemplateId: !!SMS_REGISTER_TEMPLATE_ID,
        }
      })
    }

    // Parse request body
    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON body' })
    }

    const { phone, otp, type = 'register' } = body

    if (!phone || !otp) {
      return jsonResponse({ success: false, error: 'Missing phone or otp in request body' })
    }

    // Build message per DLT registered templates
    let message = ''
    let templateId = ''

    if (type === 'reset') {
      message = `To reset your SIMPLISH TALKS account password, use the code: ${otp}. - PRAJNA DIGILAB`
      templateId = SMS_RESET_TEMPLATE_ID
    } else {
      message = `To complete your new user registration for SIMPLISH TALKS, use OTP ${otp}. Do not share this with anyone. - PRAJNA DIGILAB`
      templateId = SMS_REGISTER_TEMPLATE_ID
    }

    // Build SMSGateWayHub API URL
    let url = `https://login.smsgatewayhub.com/api/mt/SendSMS` +
      `?APIKey=${encodeURIComponent(SMS_API_KEY)}` +
      `&senderid=${encodeURIComponent(SMS_SENDER_ID)}` +
      `&channel=${encodeURIComponent(SMS_CHANNEL)}` +
      `&DCS=0&flashsms=0` +
      `&number=91${phone}` +
      `&text=${encodeURIComponent(message)}`

    if (SMS_PEID) url += `&EntityId=${encodeURIComponent(SMS_PEID)}`
    if (templateId) url += `&dlttemplateid=${encodeURIComponent(templateId)}`

    console.log(`[send-sms] Sending ${type} OTP to 91${phone}`)

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      })
    } catch (fetchErr: any) {
      console.error('[send-sms] Fetch to gateway failed:', fetchErr.message)
      return jsonResponse({
        success: false,
        error: `Gateway connection failed: ${fetchErr.message}`,
      })
    }

    const text = await response.text()
    console.log(`[send-sms] Gateway HTTP ${response.status}, body: ${text}`)

    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw_response: text }
    }

    const isSuccess =
      data?.ErrorMessage === 'Success' ||
      data?.status === 'Success' ||
      data?.ErrorCode === '000' ||
      data?.status?.toLowerCase() === 'success'

    return jsonResponse({
      success: isSuccess,
      data,
      error: isSuccess ? null : (data?.ErrorMessage || `Gateway error code: ${data?.ErrorCode}`),
    })

  } catch (error: any) {
    console.error(`[send-sms] Unexpected error:`, error.message, error.stack)
    // ALWAYS return 200 — supabase-js discards the body on non-2xx responses
    return jsonResponse({
      success: false,
      error: `Server error: ${error.message}`,
    })
  }
})
