import { supabase } from '../lib/supabase';

export interface AttributionDetails {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  attribution_method?: string;
  attributed_at?: string;
}

class AttributionService {
  /**
   * Parse UTM parameters from URL and cache them in localStorage.
   * Runs on landing page load.
   */
  public cacheUTMParameters() {
    if (typeof window === 'undefined') return;

    try {
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get('utm_source');
      const utmMedium = params.get('utm_medium');
      const utmCampaign = params.get('utm_campaign');

      // Only cache if at least utm_source is present to avoid overwriting existing valid UTMs with empty ones
      if (utmSource) {
        localStorage.setItem('simplish_utm_source', utmSource);
        localStorage.setItem('simplish_utm_medium', utmMedium || 'direct');
        localStorage.setItem('simplish_utm_campaign', utmCampaign || 'none');
        console.log('📊 Cached UTM parameters:', { utmSource, utmMedium, utmCampaign });
      }
    } catch (err) {
      console.error('Error caching UTM parameters:', err);
    }
  }

  /**
   * Retrieve cached UTM parameters from localStorage.
   */
  public getCachedUTM(): AttributionDetails {
    if (typeof window === 'undefined') {
      return { utm_source: 'organic', utm_medium: 'direct', utm_campaign: 'none' };
    }

    return {
      utm_source: localStorage.getItem('simplish_utm_source') || 'organic',
      utm_medium: localStorage.getItem('simplish_utm_medium') || 'direct',
      utm_campaign: localStorage.getItem('simplish_utm_campaign') || 'none',
    };
  }

  /**
   * Record a download click. Creates a pending attribution row in Supabase.
   */
  public async recordPendingAttribution(platform: 'android' | 'ios' = 'android') {
    try {
      const utm = this.getCachedUTM();
      const userAgent = navigator.userAgent;

      console.log(`📊 Recording pending attribution for ${platform}...`);
      
      const { error } = await supabase.from('pending_attributions').insert({
        user_agent: userAgent,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
      });

      if (error) {
        console.warn('Failed to insert pending attribution:', error);
      } else {
        console.log('✅ Pending attribution recorded successfully.');
      }
    } catch (err) {
      console.error('Error recording pending attribution:', err);
    }
  }

  /**
   * Run the attribution match. Should be called on app first open/initialize.
   */
  public async matchAndClaimAttribution(): Promise<{ matched: boolean; details?: AttributionDetails }> {
    if (typeof window === 'undefined') return { matched: false };

    try {
      // Avoid double-checking if we already resolved attribution for this device
      const alreadyChecked = localStorage.getItem('simplish_attribution_checked') === 'true';
      if (alreadyChecked) {
        const cachedMatch = {
          utm_source: localStorage.getItem('simplish_utm_source') || 'organic',
          utm_medium: localStorage.getItem('simplish_utm_medium') || 'direct',
          utm_campaign: localStorage.getItem('simplish_utm_campaign') || 'none',
        };
        return { matched: true, details: cachedMatch };
      }

      const userAgent = navigator.userAgent;
      
      console.log('🚀 Triggering attribution fingerprint matching...');
      const { data, error } = await supabase.rpc('match_and_claim_attribution', {
        p_user_agent: userAgent,
      });

      if (error) {
        throw error;
      }

      localStorage.setItem('simplish_attribution_checked', 'true');

      if (data && data.matched) {
        console.log('🎯 Attribution matched successfully!', data);
        localStorage.setItem('simplish_utm_source', data.utm_source);
        localStorage.setItem('simplish_utm_medium', data.utm_medium);
        localStorage.setItem('simplish_utm_campaign', data.utm_campaign);
        return {
          matched: true,
          details: {
            utm_source: data.utm_source,
            utm_medium: data.utm_medium,
            utm_campaign: data.utm_campaign,
          },
        };
      }

      console.log('ℹ️ No matching web attribution found; defaulting to organic.');
      return { matched: false };
    } catch (err) {
      console.error('Error during attribution matching:', err);
      return { matched: false };
    }
  }

  /**
   * Log an event to analytics_events in Supabase.
   */
  public async logEvent(eventName: string, properties: Record<string, any> = {}, platform: string = 'web') {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      const { error } = await supabase.from('analytics_events').insert({
        user_id: user?.id || null,
        event_name: eventName,
        platform,
        properties: {
          ...properties,
          timestamp: new Date().toISOString(),
          ...this.getCachedUTM()
        }
      });

      if (error) {
        console.warn('Failed to log analytics event:', error);
      }
    } catch (err) {
      console.error('Error logging analytics event:', err);
    }
  }
}

export const attributionService = new AttributionService();
