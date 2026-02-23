import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://ndbqasanctkwagyinfag.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYnFhc2FuY3Rrd2FneWluZmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MzM4MjAsImV4cCI6MjA4NDQwOTgyMH0.jOJE9ELPitovSroaoFi-q5_OZmf2V44Iy29ca0lp0Jc";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
    const { data: { user }, error: loginErr } = await supabase.auth.signInWithPassword({
        email: "testuser@example.com",
        password: "testpassword"
    });
    
    if (loginErr || !user) {
        console.error("Login Error:", loginErr?.message);
        return;
    }

    const { data: links } = await supabase.from('shared_links').select('*').eq('user_id', user.id).limit(1);
    if (!links || links.length === 0) {
        console.log("No links found for user");
        return;
    }

    const targetLink = links[0];
    console.log("Target link ID:", targetLink.id);

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
