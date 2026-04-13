export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)";
  };
  public: {
    Tables: {
      bookings: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          time_slot_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          time_slot_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          time_slot_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_time_slot_id_fkey";
            columns: ["time_slot_id"];
            isOneToOne: false;
            referencedRelation: "time_slots";
            referencedColumns: ["id"];
          }
        ];
      };
      round2_bookings: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          name: string;
          slot_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          name: string;
          slot_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          name?: string;
          slot_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "round2_bookings_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "round2_time_slots";
            referencedColumns: ["id"];
          }
        ];
      };
      round2_time_slots: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          start_time: string;
          vc_email: string;
          vc_name: string;
        };
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          start_time: string;
          vc_email: string;
          vc_name: string;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          start_time?: string;
          vc_email?: string;
          vc_name?: string;
        };
        Relationships: [];
      };
      time_slots: {
        Row: {
          created_at: string;
          date: string;
          end_time: string;
          id: string;
          max_capacity: number;
          start_time: string;
        };
        Insert: {
          created_at?: string;
          date?: string;
          end_time: string;
          id?: string;
          max_capacity?: number;
          start_time: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          end_time?: string;
          id?: string;
          max_capacity?: number;
          start_time?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
