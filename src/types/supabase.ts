
// This file is a placeholder for your Supabase types.
// You can generate them using the Supabase CLI:
// supabase gen types typescript --project-id <your-project-id> --schema public > src/types/supabase.ts
// For now, we'll define a basic Json type and an empty Database interface.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Define your tables here if needed, e.g., profiles
      // profiles: {
      //   Row: {
      //     id: string;
      //     full_name: string | null;
      //     avatar_url: string | null;
      //     role: string | null;
      //     updated_at: string | null;
      //   };
      //   Insert: {
      //     id: string;
      //     full_name?: string | null;
      //     avatar_url?: string | null;
      //     role?: string | null;
      //     updated_at?: string | null;
      //   };
      //   Update: {
      //     id?: string;
      //     full_name?: string | null;
      //     avatar_url?: string | null;
      //     role?: string | null;
      //     updated_at?: string | null;
      //   };
      // };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// You can add specific user metadata types if you know them
export interface UserMetadata {
  full_name?: string;
  avatar_url?: string;
  role?: 'student' | 'teacher';
  [key: string]: any; // Allow other properties
}
