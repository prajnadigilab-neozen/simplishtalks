
import { supabase } from '../lib/supabase';

interface TelemetryData {
    tti?: number;
    ect?: string;
    downlink?: number;
    rtt?: number;
    zip_code?: string;
    region?: string;
    is_dropped?: boolean;
    page_path?: string;
}

class TelemetryService {
    private startTime: number;
    private ttiCalculated: boolean = false;

    constructor() {
        this.startTime = performance.now();
        this.setupListeners();
    }

    private setupListeners() {
        // Track Connection Drop
        window.addEventListener('offline', () => {
            this.logMetrics({ is_dropped: true, page_path: window.location.hash });
        });

        // Track TTI when the window is fully loaded and idle
        window.addEventListener('load', () => {
            // Use requestIdleCallback if available, or a timeout
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => this.calculateTTI());
            } else {
                setTimeout(() => this.calculateTTI(), 3000);
            }
        });
    }

    private calculateTTI() {
        if (this.ttiCalculated) return;
        const tti = Math.round(performance.now());
        this.ttiCalculated = true;
        this.logMetrics({ tti });
    }

    public async logMetrics(data: TelemetryData) {
        try {
            const { data: session } = await supabase.auth.getSession();
            const user = session?.session?.user;

            // Get connection info if available
            const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
            const connectionInfo = conn ? {
                ect: conn.effectiveType,
                downlink: conn.downlink,
                rtt: conn.rtt
            } : {};

            // Get user location from metadata if available (simulated or from profile)
            // For now, we'll try to get it from the profile in a real scenario
            let locationInfo = {};
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('place')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    // Assume 'place' might contains something like "Bangalore, 560001"
                    const place = profile.place || '';
                    const zipMatch = place.match(/\b\d{6}\b/);
                    locationInfo = {
                        zip_code: zipMatch ? zipMatch[0] : null,
                        region: place.split(',')[0].trim()
                    };
                }
            }

            await supabase.from('telemetry').insert({
                user_id: user?.id || null,
                page_path: window.location.hash || '/',
                ...connectionInfo,
                ...locationInfo,
                ...data
            });
        } catch (err) {
            console.error('Failed to log telemetry:', err);
        }
    }
}

export const telemetry = new TelemetryService();
