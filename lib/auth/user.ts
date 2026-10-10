import "server-only";

import { createClient } from "@/lib/supabase/server";

// null means unauthenticated; infrastructure failures are a generic server error.
export async function getAuthenticatedUser() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403) {
        return null;
      }
      throw new Error("SERVER_ERROR");
    }
    return data.user ?? null;
  } catch {
    throw new Error("SERVER_ERROR");
  }
}
