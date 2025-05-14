
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
      proctorX: {
        Row: {
          id: string; // TEXT, stores email
          pass: string; // TEXT, stores plaintext password
          name: string | null; // TEXT, stores full name, can be null
          created_at?: string; // timestamptz
        };
        Insert: {
          id: string; // Email
          pass: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pass?: string;
          name?: string;
          created_at?: string;
        };
      };
      // ... other tables if any
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

// Simplified User object for custom context
export interface CustomUser {
  email: string;
  name: string | null; // Name can be null
}

// UserMetadata for Supabase Auth (kept for reference, but not primary for custom auth)
export interface UserMetadata {
  full_name?: string;
  avatar_url?: string;
  role?: 'student' | 'teacher';
  [key: string]: any;
}
