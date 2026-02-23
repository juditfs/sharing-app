const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ndbqasanctkwagyinfag.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYnFhc2FuY3Rrd2FneWluZmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzM4MjAsImV4cCI6MjA4NDQwOTgyMH0.jOJE9ELPitovSroaoFi-q5_OZmf2V44Iy29ca0lp0Jc";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    console.log('Logging in...');
    const { data: { user }, error: loginErr } = await supabase.auth.signInAnonymously();

    if (loginErr || !user) {
        console.error("Login Error:", loginErr?.message);
        return;
    }

    console.log('Logged in as', user.id);

    // Create a dummy link to test with since a fresh anon user has no links
    const { data: newLink, error: insertErr } = await supabase.from('shared_links').insert({
        short_code: 'TEST1234',
        photo_url: 'user/photo.enc',
        thumbnail_url: 'user/thumb.enc',
        public_thumbnail_url: 'https://example.com/thumb.jpg',
        user_id: user.id
    }).select().single();

    if (insertErr || !newLink) {
        console.error("Insert Error:", insertErr);
        return;
    }

    const { data: links } = await supabase.from('shared_links').select('*').eq('id', newLink.id).limit(1);

    if (!links || links.length === 0) {
        console.log("No links found for user");
        return;
    }

    const targetLink = links[0];
    console.log("Target link ID:", targetLink.id, "Current thumb:", targetLink.public_thumbnail_url);

    const { data, error } = await supabase.from('shared_links')
        .update({ public_thumbnail_url: null })
        .eq('id', targetLink.id)
        .select('*');

    if (error) {
        console.error("Update Error:", error);
    } else {
        console.log("Update Success:", data);
    }
}

testUpdate();
