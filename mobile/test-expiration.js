const fs = require('fs');
const path = require('path');

// Manually parse .env from mobile app without relying on npm dotenv
try {
    const envPath = path.resolve(__dirname, '../mobile/.env');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    });
} catch (e) {
    console.warn("⚠️ Could not read ../mobile/.env automatically. Relying on system process.env");
}

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ndbqasanctkwagyinfag.supabase.co";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYnFhc2FuY3Rrd2FneWluZmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzM4MjAsImV4cCI6MjA4NDQwOTgyMH0.jOJE9ELPitovSroaoFi-q5_OZmf2V44Iy29ca0lp0Jc";
const supabase = createClient(supabaseUrl, supabaseKey);

async function runExpirationTest() {
    console.log('🧪 Starting Expiration Automation Test...\n');

    const { data: { user }, error: loginErr } = await supabase.auth.signInAnonymously();
    if (loginErr || !user) {
        console.error("❌ Failed to login:", loginErr);
        process.exit(1);
    }
    console.log('✅ Logged in as anonymous tester:', user.id);

    const shortCode = 'EXP' + Math.floor(Math.random() * 100000);
    const { data: link, error: insertErr } = await supabase.from('shared_links').insert({
        short_code: shortCode,
        photo_url: `test/${shortCode}.enc`,
        thumbnail_url: `test/${shortCode}_thumb.enc`,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60000).toISOString() // 10 mins from now
    }).select().single();

    if (insertErr || !link) {
        console.error("❌ Failed to insert test link:", insertErr);
        process.exit(1);
    }
    console.log('✅ Created test link:', shortCode, 'Expires At:', link.expires_at);

    console.log('\nFetching active link via get-link Edge Function...');
    let res = await supabase.functions.invoke('get-link', {
        body: { shortCode, action: 'metadata' }
    });

    if (res.error) {
        console.error("❌ get-link returned an error for the active link!", await res.error.context?.json());
        process.exit(1);
    }
    console.log('✅ Active Link verified. Response returned 200 OK.');

    console.log('\nSimulating time passage by backdating link expiration to 10 minutes ago...');
    const pastDate = new Date(Date.now() - 10 * 60000).toISOString();

    const updateRes = await supabase.from('shared_links')
        .update({ expires_at: pastDate })
        .eq('id', link.id);

    if (updateRes.error) {
        console.error("❌ Failed to backdate the link in the database:", updateRes.error);
        process.exit(1);
    }
    console.log('✅ Database updated. `expires_at` is now in the past.');

    console.log('\nFetching expired link via get-link Edge Function...');
    res = await supabase.functions.invoke('get-link', {
        body: { shortCode, action: 'metadata' }
    });

    if (res.error) {
        const errorBody = res.error.context ? await res.error.context.json() : null;
        if (res.error.context && res.error.context.status === 410) {
            console.log('✅ SUCCESS: Edge connection rejected the payload with 410 Gone.');
            console.log(`   Message returned from server: "${errorBody?.error}"`);
        } else {
            console.error("❌ Unrecognized error thrown:", res.error);
            console.error("   Details:", errorBody);
            process.exit(1);
        }
    } else {
        console.error("❌ FAILURE: get-link returned 200 OK for an expired link!");
        process.exit(1);
    }

    console.log('\nCleaning up database...');
    await supabase.from('shared_links').delete().eq('id', link.id);
    console.log('✅ Done! All tests passed.');
}

runExpirationTest();
