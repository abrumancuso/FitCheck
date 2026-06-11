/**
 * supabaseClient.js — Configuración de Supabase
 * ===============================================
 *
 * Reemplaza a firebaseConfig.js.
 * Usa las credenciales de tu proyecto en supabase.com
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gylqtjrxxwlxmmrgezdc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bHF0anJ4eHdseG1tcmdlemRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDEyNjcsImV4cCI6MjA5NjYxNzI2N30.tPaJZTyLASJKqxhvrrqdwzLph31KRsdTCiuwJPdOLpI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
