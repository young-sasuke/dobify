// Script to update Steam Iron service with a tag
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://qehtgclgjhzdlqcjujpp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlaHRnY2xnamh6ZGxxY2p1anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NDk2NzYsImV4cCI6MjA2NjQyNTY3Nn0.P7buCrNPIBShznBQgkdEHx6BG5Bhv9HOq7pn6e0HfLo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSteamIronTag() {
  try {
    console.log('Updating Steam Iron service with tag...');
    
    // Update the Steam Iron service to add a tag
    const { data, error } = await supabase
      .from('services')
      .update({ tag: 'Premium' })
      .eq('name', 'Steam Iron')
      .select();

    if (error) {
      console.error('Error updating Steam Iron:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Successfully updated Steam Iron service:');
      console.log(data[0]);
    } else {
      console.log('No Steam Iron service found to update');
      
      // Let's check what services exist
      const { data: services, error: fetchError } = await supabase
        .from('services')
        .select('*')
        .order('name');
        
      if (fetchError) {
        console.error('Error fetching services:', fetchError);
        return;
      }
      
      console.log('Available services:');
      services.forEach(service => {
        console.log(`- ${service.name} (ID: ${service.id}, Tag: ${service.tag || 'None'})`);
      });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

updateSteamIronTag();
