import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xrgalfsjnzwyatygklev.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyZ2FsZnNqbnp3eWF0eWdrbGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzY4NDMsImV4cCI6MjA5MjU1Mjg0M30.O90wll8mY04BaxBTuhqSJ3_xH6E0BlRfSL9396GHhwo'

export const supabase = createClient(supabaseUrl, supabaseKey)
