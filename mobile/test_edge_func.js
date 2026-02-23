const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ndbqasanctkwagyinfag.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYnFhc2FuY3Rrd2FneWluZmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzM4MjAsImV4cCI6MjA4NDQwOTgyMH0.jOJE9ELPitovSroaoFi-q5_OZmf2V44Iy29ca0lp0Jc";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEdgeFunc() {
    console.log('Logging in...');
    // We can login as the test user instead of anonymous so we have the links
    const { data: { user }, error: loginErr } = await supabase.auth.signInAnonymously();

    const { data: { session } } = await supabase.auth.getSession();
    const token = session.access_token;

    const randomCode = 'DBG' + Math.floor(Math.random() * 100000);
    const { data: newLink, error: insertError } = await supabase.from('shared_links').insert({
        short_code: randomCode,
        photo_url: 'user/photo.enc',
        thumbnail_url: 'user/thumb.enc',
        public_thumbnail_url: 'https://ndbqasanctkwagyinfag.supabase.co/storage/v1/object/public/public-thumbnails/184b58b0-120e-4e48-a4aa-523910d4dc23/1771845351165_preview.jpg',
        user_id: user.id
    }).select().single();

    if (insertError) {
        console.error('Insert error:', insertError);
        return;
    }

    console.log('Created dummy link:', newLink.short_code);

    // Call edge function with undefined publicThumbnailUrl (like the failed RN client did)
    console.log('Test 1: Omitting publicThumbnailUrl');
    let res = await supabase.functions.invoke('update-link', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
            shortCode: newLink.short_code,
            updates: {
                allowDownload: false,
                expiry: "2026-02-23T12:12:50.536+00:00"
            }
        }
    });
    console.log('Test 1 Response:', res);

    // Call edge function with null publicThumbnailUrl (the fix we tried)
    console.log('\nTest 2: Explicitly passing null');
    res = await supabase.functions.invoke('update-link', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
            shortCode: newLink.short_code,
            updates: {
                allowDownload: false,
                publicThumbnailUrl: null
            }
        }
    });
    if (res.error && res.error.context) {
        console.log('Test 2 Error Body:', await res.error.context.json());
    } else {
        console.log('Test 2 Response:', res);
    }

    console.log('\nTest 3: create-link');
    const resCreate = await supabase.functions.invoke('create-link', {
        body: {
            photoUrl: 'user/photo2.enc',
            thumbnailUrl: null,
            encryptionKey: 'testkey',
            allowDownload: false
        }
    });

    if (resCreate.error && resCreate.error.context) {
        console.log('Test 3 Error Body:', await resCreate.error.context.json());
    } else {
        console.log('Test 3 Response:', resCreate);
    }
}

testEdgeFunc();
