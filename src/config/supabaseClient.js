// Supabase credentials — set these via environment variables at build/deploy time.
// For Vercel: add SUPABASE_URL and SUPABASE_ANON_KEY in Project Settings > Environment Variables.
// For local dev: copy .env.example to .env and fill in the values.
const SUPABASE_URL = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_URL)
  || window.__ENV__?.SUPABASE_URL
  || 'https://svsdkjxsjnfgfocfiirz.supabase.co';

const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env && process.env.SUPABASE_ANON_KEY)
  || window.__ENV__?.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2c2Rranhzam5mZ2ZvY2ZpaXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzYxMzgsImV4cCI6MjA5Mjk1MjEzOH0.DTmE-YgV4Qd_jI8I9HRbVS-sPrIUr9GEYIm5g4iTgt4';

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
