
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
          uuid: string; // Primary Key
          id: string; // TEXT, stores email (should be unique)
          pass: string; // TEXT, stores plaintext password
          name: string | null; // TEXT, stores full name, can be null
          role: 'student' | 'teacher' | null; // TEXT, stores user role
          created_at?: string; // timestamptz
        };
        Insert: {
          uuid?: string; // Optional on insert if DB generates it
          id: string; // Email
          pass: string;
          name: string;
          role: 'student' | 'teacher';
          created_at?: string;
        };
        Update: {
          uuid?: string;
          id?: string;
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
  uuid: string;
  email: string; // This was 'id' in proctorX, mapping to email conceptually
  name: string | null;
  role: 'student' | 'teacher' | null;
}
