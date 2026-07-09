import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * Supabase Edge Function: send-sms
 * Sends OTP via SMSGateWayHub API over HTTPS from Supabase edge network.
 * Bypasses browser CORS blocks and database TLS limitations.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Read credentials securely from Supabase Secrets (not exposed to browser)
const SMS_API_KEY = Deno.env.get('SMS_GATEWAY_API_KEY') ?? ''
const SMS_SENDER_ID = Deno.env.get('SMS_GATEWAY_SENDER_ID') ?? 'SMPLSH'
const SMS_CHANNEL = Deno.env.get('SMS_GATEWAY_CHANNEL') ?? '2'
const SMS_PEID = Deno.env.get('SMS_GATEWAY_PEID') ?? ''
const SMS_REGISTER_TEMPLATE_ID = Deno.env.get('SMS_GATEWAY_TEMPLATE_ID') ?? ''
const SMS_RESET_TEMPLATE_ID = Deno.env.get('SMS_GATEWAY_RESET_TEMPLATE_ID') ?? ''

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, otp, type = 'register' } = await req.json()

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing phone or OTP' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Build message as per DLT registered templates
    let message = ''
    let templateId = ''

    if (type === 'reset') {
      message = `To reset your SIMPLISH TALKS account password, use the code: ${otp}. - PRAJNA DIGILAB`
      templateId = SMS_RESET_TEMPLATE_ID
    } else {
      message = `To complete your new user registration for SIMPLISH TALKS, use OTP ${otp}. Do not share this with anyone. - PRAJNA DIGILAB`
      templateId = SMS_REGISTER_TEMPLATE_ID
    }

    // Build SMSGateWayHub API URL (HTTPS works from Deno edge runtime)
    let url = `https://login.smsgatewayhub.com/api/mt/SendSMS` +
      `?APIKey=${encodeURIComponent(SMS_API_KEY)}` +
      `&senderid=${encodeURIComponent(SMS_SENDER_ID)}` +
      `&channel=${encodeURIComponent(SMS_CHANNEL)}` +
      `&DCS=0&flashsms=0` +
      `&number=91${phone}` +
      `&text=${encodeURIComponent(message)}`

    if (SMS_PEID) url += `&EntityId=${encodeURIComponent(SMS_PEID)}`
    if (templateId) url += `&dlttemplateid=${encodeURIComponent(templateId)}`

    console.log(`[send-sms] Sending ${type} OTP to ${phone}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
    })

    const text = await response.text()
    let data: any
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw_response: text }
    }

    console.log(`[send-sms] Gateway response:`, data)

    const isSuccess =
      data?.ErrorMessage === 'Success' ||
      data?.status === 'Success' ||
      data?.ErrorCode === '000' ||
      data?.status?.toLowerCase() === 'success'

    return new Response(
      JSON.stringify({
        success: isSuccess,
        data,
        error: isSuccess ? null : (data?.ErrorMessage || `Error code: ${data?.ErrorCode}`)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error(`[send-sms] Unexpected error:`, error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
