
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
          user_id: string; // Primary Key (6-character ID)
          email: string; // User's email (for login, unique)
          pass: string; // Plaintext password
          name: string;
          role: 'student' | 'teacher';
          created_at?: string;
        };
        Insert: {
          user_id: string; // Must be provided on insert
          email: string;
          pass: string;
          name: string;
          role: 'student' | 'teacher';
          created_at?: string;
        };
        Update: {
          user_id?: string;
          email?: string;
          pass?: string;
          name?: string;
          role?: 'student' | 'teacher';
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

// User object for custom context
export interface CustomUser {
  user_id: string; // 6-character ID
  email: string;
  name: string | null;
  role: 'student' | 'teacher' | null;
}
