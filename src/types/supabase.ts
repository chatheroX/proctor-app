
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
          name: string; // TEXT, stores full name
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
  name: string;
}

// UserMetadata for Supabase Auth (kept for reference, but not primary for custom auth)
export interface UserMetadata {
  full_name?: string;
  avatar_url?: string;
  role?: 'student' | 'teacher';
  [key: string]: any;
}
