/**
 * Vercel Speed Insights initialization
 * This file initializes Speed Insights for the static website
 */
import { injectSpeedInsights } from '@vercel/speed-insights';

// Initialize Speed Insights
injectSpeedInsights({
  debug: false,
});
