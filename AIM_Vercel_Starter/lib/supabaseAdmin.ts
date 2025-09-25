import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export const supabaseAdmin = createClient(supabaseUrl || "", serviceRoleKey || "");

export const APP_USERS_TABLE = "app_users"; // evita colisión con auth.users
export const GROUPS_TABLE = "groups";
export const USER_GROUPS_TABLE = "user_groups";




