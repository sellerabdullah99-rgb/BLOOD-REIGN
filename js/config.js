/* ==========================================================
   BLOOD REIGN — Config
   Fill in SUPABASE_URL / SUPABASE_ANON_KEY from:
   Supabase Dashboard > Project Settings > API
   Both are safe to expose in client-side code — real protection
   comes from the Row Level Security policies in /supabase/policies.sql
   ========================================================== */

window.BR = window.BR || {};

BR.config = {
  SUPABASE_URL: 'https://rowuasvztcozsiaumrst.supabase.co', // e.g. https://xxxxxxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvd3Vhc3Z6dGNvenNpYXVtcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTExMjEsImV4cCI6MjEwMTc2NzEyMX0.yxvs59Hb1UpuHrdjcRA6pqqam2DtNQBMrSGALw3ZCq0',

  // Discord Server Settings > Integrations > Webhooks > New Webhook > Copy URL
  DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1535228730304364544/InB26aL6yi9Aqh6IscIN9ldPyXkagkf9qRmng49gImfl6MdqM1gPmo0UyQyVAokq4p5O',
  // Your Discord server invite, e.g. https://discord.gg/yourinvite — used for the support button
  DISCORD_INVITE_URL: 'https://discord.gg/YOUR_INVITE_CODE',


   // Adsterra Dashboard > Websites > your site > Direct Link — paste it here.
   // Real ad revenue: clicking "Watch Ad" opens this in a new tab.
   ADSTERRA_DIRECT_LINK: 'https://YOUR-ADSTERRA-DIRECT-LINK-HERE',

  ADMIN_TAP_GATE_PASSWORD: 'bloodreign2026BR', // front-end gate only; real security = is_admin flag + RLS

  VIP_TIERS: [
    { key: 'bronze',  label: 'Bronze',  min: 0,    max: 499,  icon: 'fa-shield-halved', color: '#8a8a9a' },
    { key: 'silver',  label: 'Silver',  min: 500,  max: 1499, icon: 'fa-shield-heart',  color: '#c7c9d1' },
    { key: 'gold',    label: 'Gold',    min: 1500, max: 2999, icon: 'fa-shield',        color: '#c9a84c' },
    { key: 'diamond', label: 'Diamond', min: 3000, max: Infinity, icon: 'fa-gem',       color: '#7dd3fc' },
  ],

  COSMETIC_REWARDS: [
    { key: 'avatar_frame',      label: 'Avatar Frame',      cost: 100, icon: 'fa-image' },
    { key: 'username_color',    label: 'Username Color',    cost: 75,  icon: 'fa-palette' },
    { key: 'leaderboard_badge', label: 'Leaderboard Badge', cost: 150, icon: 'fa-award' },
    { key: 'profile_shield',    label: 'Profile Shield',    cost: 200, icon: 'fa-shield' },
  ],

  DISCOUNT_REWARDS: [
    { key: 'discount_5',  label: '5% off next order',        cost: 50,  icon: 'fa-tag' },
    { key: 'discount_10', label: '10% off next order',       cost: 150, icon: 'fa-tags' },
    { key: 'free_delivery', label: 'Free delivery',          cost: 300, icon: 'fa-truck-fast' },
    { key: 'discount_20', label: '20% off + free delivery',  cost: 500, icon: 'fa-crown' },
  ],

  BADGES: [
    { key: 'first_tournament', label: 'First Tournament', icon: 'fa-flag-checkered', desc: 'Joined your first tournament' },
    { key: 'shop_explorer',    label: 'Shop Explorer',    icon: 'fa-bag-shopping',   desc: 'Browsed the shop' },
    { key: 'coin_collector',   label: 'Coin Collector',   icon: 'fa-coins',          desc: 'Earned 500+ coins' },
  ],

  CATEGORIES: ['All', 'School', 'Laptop', 'Ladies', 'Travel', 'Saree'],
};
