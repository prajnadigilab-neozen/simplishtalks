import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * Supabase Edge Function: send-sms
 * Proxies OTP requests to SMSGateWayHub from Supabase's edge network.
 * smsgatewayhub.com rejects HTTPS from server environments, so we try HTTP first.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200, // Always 200 — supabase-js discards body on non-2xx
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SMS_API_KEY = Deno.env.get('SMS_GATEWAY_API_KEY') ?? ''
    const SMS_SENDER_ID = Deno.env.get('SMS_GATEWAY_SENDER_ID') ?? 'SMPLSH'
    const SMS_CHANNEL_RAW = Deno.env.get('SMS_GATEWAY_CHANNEL') ?? '2'
    const SMS_ROUTE_RAW = Deno.env.get('SMS_GATEWAY_ROUTE') ?? ''
    const SMS_PEID = Deno.env.get('SMS_GATEWAY_PEID') ?? ''
    const SMS_REGISTER_TEMPLATE_ID = Deno.env.get('SMS_GATEWAY_TEMPLATE_ID') ?? ''
    const SMS_RESET_TEMPLATE_ID = Deno.env.get('SMS_GATEWAY_RESET_TEMPLATE_ID') ?? ''

    // Smart mapping: if channel is set to a route ID (e.g. '47'), separate them
    let SMS_CHANNEL = SMS_CHANNEL_RAW
    let SMS_ROUTE = SMS_ROUTE_RAW
    if (SMS_CHANNEL_RAW !== '1' && SMS_CHANNEL_RAW !== '2' && SMS_CHANNEL_RAW.toUpperCase() !== 'OTP' && SMS_CHANNEL_RAW.toUpperCase() !== 'INT') {
      SMS_ROUTE = SMS_CHANNEL_RAW
      SMS_CHANNEL = '2' // Default to Transactional
    }

    if (!SMS_API_KEY) {
      return jsonResponse({
        success: false,
        error: 'SMS_GATEWAY_API_KEY secret is not set in Supabase.',
        debug: { hasApiKey: false, hasSenderId: !!SMS_SENDER_ID, hasPeid: !!SMS_PEID },
      })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON body' })
    }

    const { phone, otp, type = 'register' } = body
    if (!phone || !otp) {
      return jsonResponse({ success: false, error: 'Missing phone or otp' })
    }

    // Build message per DLT templates
    let message: string
    let templateId: string
    if (type === 'reset') {
      message = `To reset your SIMPLISH TALKS account password, use the code: ${otp}. - PRAJNA DIGILAB`
      templateId = SMS_RESET_TEMPLATE_ID
    } else {
      message = `To complete your new user registration for SIMPLISH TALKS, use OTP ${otp}. Do not share this with anyone. - PRAJNA DIGILAB`
      templateId = SMS_REGISTER_TEMPLATE_ID
    }

    // Build query string (shared between HTTP and HTTPS attempts)
    let qs = `?APIKey=${encodeURIComponent(SMS_API_KEY)}` +
      `&senderid=${encodeURIComponent(SMS_SENDER_ID)}` +
      `&channel=${encodeURIComponent(SMS_CHANNEL)}` +
      `&DCS=0&flashsms=0` +
      `&number=91${phone}` +
      `&text=${encodeURIComponent(message)}`
    if (SMS_ROUTE) qs += `&route=${encodeURIComponent(SMS_ROUTE)}`
    if (SMS_PEID) qs += `&EntityId=${encodeURIComponent(SMS_PEID)}`
    if (templateId) qs += `&dlttemplateid=${encodeURIComponent(templateId)}`

    const httpUrl = `http://www.smsgatewayhub.com/api/mt/SendSMS${qs}`
    const httpsUrl = `https://www.smsgatewayhub.com/api/mt/SendSMS${qs}`

    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
    }

    console.log(`[send-sms] Sending ${type} OTP to 91${phone}`)

    let response: Response | null = null
    let usedProtocol = ''
    let httpError = ''
    let httpsError = ''

    // Attempt 1: HTTPS (preferred modern secure endpoint)
    try {
      console.log('[send-sms] Trying HTTPS...')
      response = await fetch(httpsUrl, { method: 'GET', headers: fetchHeaders })
      usedProtocol = 'https'
    } catch (err: any) {
      httpsError = err.message
      console.warn(`[send-sms] HTTPS failed: ${httpsError}`)
    }

    // Attempt 2: HTTP fallback
    if (!response || response.status !== 200) {
      try {
        console.log('[send-sms] Trying HTTP...')
        response = await fetch(httpUrl, { method: 'GET', headers: fetchHeaders })
        usedProtocol = 'http'
      } catch (err: any) {
        httpError = err.message
        console.error(`[send-sms] HTTP also failed: ${httpError}`)
      }
    }

    if (!response) {
      return jsonResponse({
        success: false,
        error: `Gateway unreachable. HTTP: ${httpError}. HTTPS: ${httpsError}`,
      })
    }

    const text = await response.text()
    console.log(`[send-sms] Gateway responded via ${usedProtocol}, HTTP ${response.status}: ${text}`)

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
      protocol: usedProtocol,
      data,
      error: isSuccess ? null : (data?.ErrorMessage || `Gateway error code: ${data?.ErrorCode}`),
    })

  } catch (error: any) {
    console.error('[send-sms] Unexpected error:', error.message)
    return jsonResponse({ success: false, error: `Server error: ${error.message}` })
  }
})
