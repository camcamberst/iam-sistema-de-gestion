"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * 🔐 TokenAutoLogin
 * Reads access_token and refresh_token from URL query params
 * and auto-sets the Supabase session.
 * 
 * Used by OS|AIM to pass the model's auth tokens when opening
 * "Gestión" so they don't need to log in again.
 */
export default function TokenAutoLogin() {
  useEffect(() => {
    async function checkUrlTokens() {
      try {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken) return;

        console.log("🔐 [AutoLogin] Token found in URL, setting session...");

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        });

        if (error) {
          console.error("❌ [AutoLogin] Failed:", error.message);
          return;
        }

        if (data.session) {
          console.log("✅ [AutoLogin] Session set successfully");

          // Clean the URL to remove tokens (security)
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);

          // Redirect to admin dashboard (the model's main view)
          const { data: userData } = await supabase
            .from("users")
            .select("role")
            .eq("id", data.session.user.id)
            .single();

          const role = userData?.role || "modelo";
          const dashboardPath =
            role === "modelo"
              ? "/admin/model/portafolio"
              : role === "admin"
              ? "/admin"
              : role === "super_admin"
              ? "/superadmin"
              : "/admin";

          window.location.href = dashboardPath;
        }
      } catch (err) {
        console.error("❌ [AutoLogin] Error:", err);
      }
    }

    checkUrlTokens();
  }, []);

  return null; // This component renders nothing
}
