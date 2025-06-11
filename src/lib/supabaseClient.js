// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'URL_NO_DEFINIDA'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'CLAVE_NO_DEFINIDA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
