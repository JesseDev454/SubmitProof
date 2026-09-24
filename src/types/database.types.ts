export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assignment_policy_versions: {
        Row: {
          allowed_mime_types: string[]
          assignment_id: string
          created_at: string
          created_by: string
          deadline_at: string
          fallback_enabled: boolean
          grace_period_minutes: number
          id: string
          max_file_size_bytes: number
          version_number: number
        }
        Insert: {
          allowed_mime_types: string[]
          assignment_id: string
          created_at?: string
          created_by: string
          deadline_at: string
          fallback_enabled?: boolean
          grace_period_minutes?: number
          id?: string
          max_file_size_bytes: number
          version_number: number
        }
        Update: {
          allowed_mime_types?: string[]
          assignment_id?: string
          created_at?: string
          created_by?: string
          deadline_at?: string
          fallback_enabled?: boolean
          grace_period_minutes?: number
          id?: string
          max_file_size_bytes?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignment_policy_versions_assignment_owner_fk"
            columns: ["assignment_id", "created_by"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id", "created_by"]
          },
        ]
      }
      assignment_tokens: {
        Row: {
          assignment_id: string
          id: string
          issued_at: string
          phone_e164_snapshot: string
          revoked_at: string | null
          student_id: string
          token_hash: string
        }
        Insert: {
          assignment_id: string
          id?: string
          issued_at?: string
          phone_e164_snapshot: string
          revoked_at?: string | null
          student_id: string
          token_hash: string
        }
        Update: {
          assignment_id?: string
          id?: string
          issued_at?: string
          phone_e164_snapshot?: string
          revoked_at?: string | null
          student_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_tokens_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          course_id: string
          created_at: string
          created_by: string
          current_policy_version_id: string | null
          description: string | null
          id: string
          status: Database["public"]["Enums"]["assignment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by: string
          current_policy_version_id?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string
          current_policy_version_id?: string | null
          description?: string | null
          id?: string
          status?: Database["public"]["Enums"]["assignment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_owner_fk"
            columns: ["course_id", "created_by"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "lecturer_id"]
          },
          {
            foreignKeyName: "assignments_current_policy_version_fk"
            columns: ["id", "current_policy_version_id"]
            isOneToOne: false
            referencedRelation: "assignment_policy_versions"
            referencedColumns: ["assignment_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          actor_id: string | null
          assignment_id: string | null
          commitment_id: string | null
          course_id: string | null
          event_at: string
          event_type: string
          id: string
          metadata: Json
          recorded_at: string
          source: string
          submission_id: string | null
          upload_id: string | null
        }
        Insert: {
          actor_id?: string | null
          assignment_id?: string | null
          commitment_id?: string | null
          course_id?: string | null
          event_at: string
          event_type: string
          id?: string
          metadata?: Json
          recorded_at?: string
          source: string
          submission_id?: string | null
          upload_id?: string | null
        }
        Update: {
          actor_id?: string | null
          assignment_id?: string | null
          commitment_id?: string | null
          course_id?: string | null
          event_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          recorded_at?: string
          source?: string
          submission_id?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "submission_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          assignment_id: string
          created_at: string
          file_sha256: string
          gateway_event_at: string | null
          id: string
          nonce: string
          policy_version_id: string
          processed_at: string
          provider_message_id: string
          sender_phone_e164: string
          student_id: string
          submission_id: string
          token_id: string
          webhook_received_at: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          file_sha256: string
          gateway_event_at?: string | null
          id?: string
          nonce: string
          policy_version_id: string
          processed_at: string
          provider_message_id: string
          sender_phone_e164: string
          student_id: string
          submission_id: string
          token_id: string
          webhook_received_at: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          file_sha256?: string
          gateway_event_at?: string | null
          id?: string
          nonce?: string
          policy_version_id?: string
          processed_at?: string
          provider_message_id?: string
          sender_phone_e164?: string
          student_id?: string
          submission_id?: string
          token_id?: string
          webhook_received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_policy_assignment_fk"
            columns: ["assignment_id", "policy_version_id"]
            isOneToOne: false
            referencedRelation: "assignment_policy_versions"
            referencedColumns: ["assignment_id", "id"]
          },
          {
            foreignKeyName: "commitments_submission_owner_fk"
            columns: ["submission_id", "assignment_id", "student_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id", "assignment_id", "student_id"]
          },
          {
            foreignKeyName: "commitments_token_owner_phone_fk"
            columns: [
              "token_id",
              "assignment_id",
              "student_id",
              "sender_phone_e164",
            ]
            isOneToOne: false
            referencedRelation: "assignment_tokens"
            referencedColumns: [
              "id",
              "assignment_id",
              "student_id",
              "phone_e164_snapshot",
            ]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          id: string
          lecturer_id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          lecturer_id: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          lecturer_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          phone_e164: string | null
          role: Database["public"]["Enums"]["profile_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id: string
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_e164?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          updated_at?: string
        }
        Relationships: []
      }
      submission_uploads: {
        Row: {
          assignment_id: string
          id: string
          matched_commitment_id: string | null
          policy_result: Database["public"]["Enums"]["policy_result"]
          server_sha256: string
          storage_object_path: string
          student_id: string
          submission_id: string
          uploaded_at: string
          verification_result: Database["public"]["Enums"]["verification_result"]
        }
        Insert: {
          assignment_id: string
          id?: string
          matched_commitment_id?: string | null
          policy_result?: Database["public"]["Enums"]["policy_result"]
          server_sha256: string
          storage_object_path: string
          student_id: string
          submission_id: string
          uploaded_at?: string
          verification_result?: Database["public"]["Enums"]["verification_result"]
        }
        Update: {
          assignment_id?: string
          id?: string
          matched_commitment_id?: string | null
          policy_result?: Database["public"]["Enums"]["policy_result"]
          server_sha256?: string
          storage_object_path?: string
          student_id?: string
          submission_id?: string
          uploaded_at?: string
          verification_result?: Database["public"]["Enums"]["verification_result"]
        }
        Relationships: [
          {
            foreignKeyName: "submission_uploads_matched_commitment_owner_fk"
            columns: ["matched_commitment_id", "assignment_id", "student_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id", "assignment_id", "student_id"]
          },
          {
            foreignKeyName: "submission_uploads_submission_owner_fk"
            columns: ["submission_id", "assignment_id", "student_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id", "assignment_id", "student_id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          student_id: string
          updated_at: string
          workflow_status: Database["public"]["Enums"]["submission_workflow_status"]
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          student_id: string
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["submission_workflow_status"]
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          student_id?: string
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["submission_workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          commitment_id: string | null
          created_at: string
          gateway_event_at: string | null
          id: string
          limited_metadata: Json
          outcome: Database["public"]["Enums"]["webhook_outcome"]
          processed_at: string | null
          provider: string
          provider_message_id: string | null
          received_at: string
        }
        Insert: {
          commitment_id?: string | null
          created_at?: string
          gateway_event_at?: string | null
          id?: string
          limited_metadata?: Json
          outcome: Database["public"]["Enums"]["webhook_outcome"]
          processed_at?: string | null
          provider: string
          provider_message_id?: string | null
          received_at?: string
        }
        Update: {
          commitment_id?: string | null
          created_at?: string
          gateway_event_at?: string | null
          id?: string
          limited_metadata?: Json
          outcome?: Database["public"]["Enums"]["webhook_outcome"]
          processed_at?: string | null
          provider?: string
          provider_message_id?: string | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      assignment_status: "draft" | "published" | "closed"
      policy_result:
        | "pending"
        | "qualifies"
        | "does_not_qualify"
        | "not_applicable"
      profile_role: "student" | "lecturer"
      submission_workflow_status:
        | "pending"
        | "awaiting_upload"
        | "upload_received"
        | "complete"
      verification_result: "pending" | "match" | "mismatch" | "not_applicable"
      webhook_outcome:
        | "received"
        | "accepted"
        | "duplicate"
        | "rejected"
        | "processing_failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_status: ["draft", "published", "closed"],
      policy_result: [
        "pending",
        "qualifies",
        "does_not_qualify",
        "not_applicable",
      ],
      profile_role: ["student", "lecturer"],
      submission_workflow_status: [
        "pending",
        "awaiting_upload",
        "upload_received",
        "complete",
      ],
      verification_result: ["pending", "match", "mismatch", "not_applicable"],
      webhook_outcome: [
        "received",
        "accepted",
        "duplicate",
        "rejected",
        "processing_failed",
      ],
    },
  },
} as const

