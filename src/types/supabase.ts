
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Define QuestionOption and Question interfaces specifically for exam questions
export interface QuestionOption {
  id: string; // Unique ID for the option (e.g., opt-1, opt-2)
  text: string;
}

export interface Question {
  id: string; // Unique ID for the question (e.g., q-1)
  text: string;
  options: QuestionOption[];
  correctOptionId: string; // ID of the correct QuestionOption
}

export interface Database {
  public: {
    Tables: {
      proctorX: {
        Row: {
          user_id: string; // Primary Key (6-character ID)
          email: string;
          pass: string;
          name: string;
          role: 'student' | 'teacher';
          created_at?: string;
        };
        Insert: {
          user_id: string;
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
      ExamX: {
        Row: {
          exam_id: string; // UUID, Primary Key
          teacher_id: string; // Foreign Key to proctorX.user_id
          title: string;
          description: string | null;
          duration: number; // in minutes
          allow_backtracking: boolean;
          questions: Question[] | null; // JSONB stored as array of Question objects
          exam_code: string; // Unique code for students to join
          status: 'Draft' | 'Published' | 'Ongoing' | 'Completed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          exam_id?: string; // Optional on insert, DB defaults to gen_random_uuid()
          teacher_id: string;
          title: string;
          description?: string | null;
          duration: number;
          allow_backtracking?: boolean;
          questions?: Question[] | null;
          exam_code: string;
          status?: 'Draft' | 'Published' | 'Ongoing' | 'Completed';
          created_at?: string; // Optional on insert
          updated_at?: string; // Optional on insert
        };
        Update: {
          exam_id?: string;
          teacher_id?: string;
          title?: string;
          description?: string | null;
          duration?: number;
          allow_backtracking?: boolean;
          questions?: Question[] | null;
          exam_code?: string;
          status?: 'Draft' | 'Published' | 'Ongoing' | 'Completed';
          updated_at?: string;
        };
      };
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

export type ProctorXTable = Database['public']['Tables']['proctorX'];
export type CustomUser = {
  user_id: string; // 6-character ID
  email: string;
  name: string | null;
  role: 'student' | 'teacher' | null;
};

export type ExamXTable = Database['public']['Tables']['ExamX'];
export type Exam = ExamXTable['Row'];
