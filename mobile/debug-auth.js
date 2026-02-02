
const { createClient } = require('@supabase/supabase-js');

// Hardcode values from .env to avoid loading issues in this standalone script
const supabaseUrl = 'https://ndbqasanctkwagyinfag.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYnFhc2FuY3Rrd2FneWluZmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzM4MjAsImV4cCI6MjA4NDQwOTgyMH0.jOJE9ELPitovSroaoFi-q5_OZmf2V44Iy29ca0lp0Jc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
    console.log('Testing connection to:', supabaseUrl);
    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
            console.error('Error:', error);
            if (error.cause) console.error('Cause:', error.cause);
        } else {
            console.log('Success:', data);
        }
    } catch (err) {
        console.error('Catch Error:', err);
    }
}

testAuth();
