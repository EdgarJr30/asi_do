export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_error_logs: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string
          id: string
          is_resolved: boolean
          metadata: Json
          resolved_at: string | null
          resolved_by_user_id: string | null
          route: string | null
          severity: string
          source: string
          updated_at: string
          user_id: string | null
          user_message: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message: string
          id?: string
          is_resolved?: boolean
          metadata?: Json
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          route?: string | null
          severity?: string
          source: string
          updated_at?: string
          user_id?: string | null
          user_message: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string
          id?: string
          is_resolved?: boolean
          metadata?: Json
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          route?: string | null
          severity?: string
          source?: string
          updated_at?: string
          user_id?: string | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_error_logs_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      application_answers: {
        Row: {
          answer_json: Json | null
          answer_text: string | null
          application_id: string
          created_at: string
          id: string
          screening_question_id: string
          updated_at: string
        }
        Insert: {
          answer_json?: Json | null
          answer_text?: string | null
          application_id: string
          created_at?: string
          id?: string
          screening_question_id: string
          updated_at?: string
        }
        Update: {
          answer_json?: Json | null
          answer_text?: string | null
          application_id?: string
          created_at?: string
          id?: string
          screening_question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_screening_question_id_fkey"
            columns: ["screening_question_id"]
            isOneToOne: false
            referencedRelation: "job_screening_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          application_id: string
          author_user_id: string
          body: string
          created_at: string
          id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          application_id: string
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          application_id?: string
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_notes_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      application_ratings: {
        Row: {
          application_id: string
          author_user_id: string
          created_at: string
          id: string
          rubric_json: Json
          score: number
          updated_at: string
        }
        Insert: {
          application_id: string
          author_user_id: string
          created_at?: string
          id?: string
          rubric_json?: Json
          score: number
          updated_at?: string
        }
        Update: {
          application_id?: string
          author_user_id?: string
          created_at?: string
          id?: string
          rubric_json?: Json
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_ratings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_ratings_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      application_stage_history: {
        Row: {
          application_id: string
          changed_at: string
          changed_by_user_id: string
          from_stage_id: string | null
          id: string
          note: string | null
          to_stage_id: string
        }
        Insert: {
          application_id: string
          changed_at?: string
          changed_by_user_id: string
          from_stage_id?: string | null
          id?: string
          note?: string | null
          to_stage_id: string
        }
        Update: {
          application_id?: string
          changed_at?: string
          changed_by_user_id?: string
          from_stage_id?: string | null
          id?: string
          note?: string | null
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_stage_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          candidate_display_name_snapshot: string
          candidate_email_snapshot: string | null
          candidate_headline_snapshot: string | null
          candidate_profile_id: string
          candidate_summary_snapshot: string | null
          cover_letter: string | null
          created_at: string
          current_stage_id: string | null
          id: string
          job_posting_id: string
          status_public: Database["public"]["Enums"]["application_public_status"]
          submitted_at: string
          submitted_resume_filename: string | null
          submitted_resume_id: string | null
          updated_at: string
        }
        Insert: {
          candidate_display_name_snapshot: string
          candidate_email_snapshot?: string | null
          candidate_headline_snapshot?: string | null
          candidate_profile_id: string
          candidate_summary_snapshot?: string | null
          cover_letter?: string | null
          created_at?: string
          current_stage_id?: string | null
          id?: string
          job_posting_id: string
          status_public?: Database["public"]["Enums"]["application_public_status"]
          submitted_at?: string
          submitted_resume_filename?: string | null
          submitted_resume_id?: string | null
          updated_at?: string
        }
        Update: {
          candidate_display_name_snapshot?: string
          candidate_email_snapshot?: string | null
          candidate_headline_snapshot?: string | null
          candidate_profile_id?: string
          candidate_summary_snapshot?: string | null
          cover_letter?: string | null
          created_at?: string
          current_stage_id?: string | null
          id?: string
          job_posting_id?: string
          status_public?: Database["public"]["Enums"]["application_public_status"]
          submitted_at?: string
          submitted_resume_filename?: string | null
          submitted_resume_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_submitted_resume_id_fkey"
            columns: ["submitted_resume_id"]
            isOneToOne: false
            referencedRelation: "candidate_resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          actor_membership_id: string | null
          actor_user_id: string | null
          changed_fields: string[]
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          jwt_claims: Json
          new_record: Json | null
          old_record: Json | null
          payload: Json
          record_id: string | null
          request_headers: Json
          schema_name: string | null
          source: string
          tenant_id: string | null
          transaction_id: number | null
        }
        Insert: {
          actor_membership_id?: string | null
          actor_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          jwt_claims?: Json
          new_record?: Json | null
          old_record?: Json | null
          payload?: Json
          record_id?: string | null
          request_headers?: Json
          schema_name?: string | null
          source?: string
          tenant_id?: string | null
          transaction_id?: number | null
        }
        Update: {
          actor_membership_id?: string | null
          actor_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          jwt_claims?: Json
          new_record?: Json | null
          old_record?: Json | null
          payload?: Json
          record_id?: string | null
          request_headers?: Json
          schema_name?: string | null
          source?: string
          tenant_id?: string | null
          transaction_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_educations: {
        Row: {
          candidate_profile_id: string
          created_at: string
          degree_name: string
          end_date: string | null
          field_of_study: string | null
          id: string
          institution_name: string
          is_current: boolean
          sort_order: number
          start_date: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          degree_name: string
          end_date?: string | null
          field_of_study?: string | null
          id?: string
          institution_name: string
          is_current?: boolean
          sort_order?: number
          start_date?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          degree_name?: string
          end_date?: string | null
          field_of_study?: string | null
          id?: string
          institution_name?: string
          is_current?: boolean
          sort_order?: number
          start_date?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_educations_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_experiences: {
        Row: {
          candidate_profile_id: string
          city_name: string | null
          company_name: string
          country_code: string | null
          created_at: string
          employment_type: string | null
          end_date: string | null
          id: string
          is_current: boolean
          role_title: string
          sort_order: number
          start_date: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          candidate_profile_id: string
          city_name?: string | null
          company_name: string
          country_code?: string | null
          created_at?: string
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          role_title: string
          sort_order?: number
          start_date: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          candidate_profile_id?: string
          city_name?: string | null
          company_name?: string
          country_code?: string | null
          created_at?: string
          employment_type?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          role_title?: string
          sort_order?: number
          start_date?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_experiences_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_languages: {
        Row: {
          candidate_profile_id: string
          created_at: string
          id: string
          language_name: string
          proficiency_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          id?: string
          language_name: string
          proficiency_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          id?: string
          language_name?: string
          proficiency_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_languages_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_links: {
        Row: {
          candidate_profile_id: string
          created_at: string
          id: string
          label: string | null
          link_type: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          id?: string
          label?: string | null
          link_type?: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          id?: string
          label?: string | null
          link_type?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_links_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          city_name: string | null
          completeness_score: number
          country_code: string | null
          created_at: string
          desired_role: string | null
          headline: string | null
          id: string
          is_visible_to_recruiters: boolean
          summary: string | null
          updated_at: string
          user_id: string
          visibility: string
          visibility_updated_at: string
        }
        Insert: {
          city_name?: string | null
          completeness_score?: number
          country_code?: string | null
          created_at?: string
          desired_role?: string | null
          headline?: string | null
          id?: string
          is_visible_to_recruiters?: boolean
          summary?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
          visibility_updated_at?: string
        }
        Update: {
          city_name?: string | null
          completeness_score?: number
          country_code?: string | null
          created_at?: string
          desired_role?: string | null
          headline?: string | null
          id?: string
          is_visible_to_recruiters?: boolean
          summary?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
          visibility_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_resumes: {
        Row: {
          candidate_profile_id: string
          created_at: string
          file_size_bytes: number
          filename: string
          id: string
          is_default: boolean
          mime_type: string
          storage_path: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          file_size_bytes: number
          filename: string
          id?: string
          is_default?: boolean
          mime_type: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          file_size_bytes?: number
          filename?: string
          id?: string
          is_default?: boolean
          mime_type?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_resumes_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_skills: {
        Row: {
          candidate_profile_id: string
          created_at: string
          id: string
          proficiency_label: string | null
          skill_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          id?: string
          proficiency_label?: string | null
          skill_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          id?: string
          proficiency_label?: string | null
          skill_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_skills_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      church_associations: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          union_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          union_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          union_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_associations_union_id_fkey"
            columns: ["union_id"]
            isOneToOne: false
            referencedRelation: "church_unions"
            referencedColumns: ["id"]
          },
        ]
      }
      church_districts: {
        Row: {
          association_id: string
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          association_id: string
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_districts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "church_associations"
            referencedColumns: ["id"]
          },
        ]
      }
      church_unions: {
        Row: {
          code: string
          country_code: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          country_code?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          country_code?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      churches: {
        Row: {
          city: string | null
          code: string
          created_at: string
          district_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          created_at?: string
          district_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          created_at?: string
          district_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "churches_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "church_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          company_email: string | null
          company_phone: string | null
          country_code: string | null
          cover_image_path: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          industry: string | null
          is_public: boolean
          legal_name: string
          logo_path: string | null
          profile_kind: Database["public"]["Enums"]["tenant_kind"]
          profile_metadata: Json
          size_range: string | null
          tenant_id: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          company_email?: string | null
          company_phone?: string | null
          country_code?: string | null
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          industry?: string | null
          is_public?: boolean
          legal_name: string
          logo_path?: string | null
          profile_kind?: Database["public"]["Enums"]["tenant_kind"]
          profile_metadata?: Json
          size_range?: string | null
          tenant_id: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          company_email?: string | null
          company_phone?: string | null
          country_code?: string | null
          cover_image_path?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          industry?: string | null
          is_public?: boolean
          legal_name?: string
          logo_path?: string | null
          profile_kind?: Database["public"]["Enums"]["tenant_kind"]
          profile_metadata?: Json
          size_range?: string | null
          tenant_id?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_enabled: boolean
          metadata: Json
          scope_id: string | null
          scope_type: Database["public"]["Enums"]["feature_scope_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["feature_scope_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json
          scope_id?: string | null
          scope_type?: Database["public"]["Enums"]["feature_scope_type"]
          updated_at?: string
        }
        Relationships: []
      }
      institutional_membership_applications: {
        Row: {
          applicant_email: string
          applicant_first_name: string
          applicant_last_name: string
          applicant_phone: string
          assigned_pastor_user_id: string | null
          assigned_queue: Database["public"]["Enums"]["membership_application_queue"]
          category_name: string
          category_slug: string
          church_city: string
          church_id: string | null
          church_state_province: string
          conference_name: string
          created_at: string
          dues: string
          eligibility_snapshot: Json
          home_church_name: string
          id: string
          pastor_email: string
          pastor_name: string
          pastor_phone: string
          pastoral_reference_status: Database["public"]["Enums"]["pastoral_reference_status"]
          requester_user_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at: string
          submitted_form_snapshot: Json
          updated_at: string
        }
        Insert: {
          applicant_email: string
          applicant_first_name: string
          applicant_last_name: string
          applicant_phone: string
          assigned_pastor_user_id?: string | null
          assigned_queue?: Database["public"]["Enums"]["membership_application_queue"]
          category_name: string
          category_slug: string
          church_city: string
          church_id?: string | null
          church_state_province: string
          conference_name: string
          created_at?: string
          dues: string
          eligibility_snapshot?: Json
          home_church_name: string
          id?: string
          pastor_email: string
          pastor_name: string
          pastor_phone: string
          pastoral_reference_status?: Database["public"]["Enums"]["pastoral_reference_status"]
          requester_user_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at?: string
          submitted_form_snapshot?: Json
          updated_at?: string
        }
        Update: {
          applicant_email?: string
          applicant_first_name?: string
          applicant_last_name?: string
          applicant_phone?: string
          assigned_pastor_user_id?: string | null
          assigned_queue?: Database["public"]["Enums"]["membership_application_queue"]
          category_name?: string
          category_slug?: string
          church_city?: string
          church_id?: string | null
          church_state_province?: string
          conference_name?: string
          created_at?: string
          dues?: string
          eligibility_snapshot?: Json
          home_church_name?: string
          id?: string
          pastor_email?: string
          pastor_name?: string
          pastor_phone?: string
          pastoral_reference_status?: Database["public"]["Enums"]["pastoral_reference_status"]
          requester_user_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at?: string
          submitted_form_snapshot?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institutional_membership_applicati_assigned_pastor_user_id_fkey"
            columns: ["assigned_pastor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_membership_applications_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_membership_applications_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "institutional_membership_applications_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_alerts: {
        Row: {
          candidate_profile_id: string
          created_at: string
          criteria_json: Json
          frequency: string
          id: string
          is_active: boolean
          label: string
          updated_at: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          criteria_json?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          label: string
          updated_at?: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          criteria_json?: Json
          frequency?: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_alerts_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          archived_at: string | null
          city_name: string | null
          closed_at: string | null
          company_profile_id: string
          compensation_currency: string | null
          compensation_max_amount: number | null
          compensation_min_amount: number | null
          compensation_type: Database["public"]["Enums"]["opportunity_compensation_type"]
          country_code: string | null
          created_at: string
          created_by_user_id: string | null
          description: string
          employment_type: Database["public"]["Enums"]["job_employment_type"]
          experience_level: string | null
          expires_at: string | null
          id: string
          is_featured: boolean
          opportunity_metadata: Json
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          published_at: string | null
          salary_currency: string | null
          salary_max_amount: number | null
          salary_min_amount: number | null
          salary_visible: boolean
          slug: string
          status: Database["public"]["Enums"]["job_posting_status"]
          summary: string
          tenant_id: string
          title: string
          updated_at: string
          workplace_type: Database["public"]["Enums"]["job_workplace_type"]
        }
        Insert: {
          archived_at?: string | null
          city_name?: string | null
          closed_at?: string | null
          company_profile_id: string
          compensation_currency?: string | null
          compensation_max_amount?: number | null
          compensation_min_amount?: number | null
          compensation_type?: Database["public"]["Enums"]["opportunity_compensation_type"]
          country_code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description: string
          employment_type?: Database["public"]["Enums"]["job_employment_type"]
          experience_level?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean
          opportunity_metadata?: Json
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          published_at?: string | null
          salary_currency?: string | null
          salary_max_amount?: number | null
          salary_min_amount?: number | null
          salary_visible?: boolean
          slug: string
          status?: Database["public"]["Enums"]["job_posting_status"]
          summary: string
          tenant_id: string
          title: string
          updated_at?: string
          workplace_type?: Database["public"]["Enums"]["job_workplace_type"]
        }
        Update: {
          archived_at?: string | null
          city_name?: string | null
          closed_at?: string | null
          company_profile_id?: string
          compensation_currency?: string | null
          compensation_max_amount?: number | null
          compensation_min_amount?: number | null
          compensation_type?: Database["public"]["Enums"]["opportunity_compensation_type"]
          country_code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          employment_type?: Database["public"]["Enums"]["job_employment_type"]
          experience_level?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean
          opportunity_metadata?: Json
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          published_at?: string | null
          salary_currency?: string | null
          salary_max_amount?: number | null
          salary_min_amount?: number | null
          salary_visible?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["job_posting_status"]
          summary?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          workplace_type?: Database["public"]["Enums"]["job_workplace_type"]
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_screening_questions: {
        Row: {
          answer_type: Database["public"]["Enums"]["job_screening_answer_type"]
          created_at: string
          helper_text: string | null
          id: string
          is_required: boolean
          job_posting_id: string
          options_json: Json
          question_text: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer_type?: Database["public"]["Enums"]["job_screening_answer_type"]
          created_at?: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          job_posting_id: string
          options_json?: Json
          question_text: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer_type?: Database["public"]["Enums"]["job_screening_answer_type"]
          created_at?: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          job_posting_id?: string
          options_json?: Json
          question_text?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_screening_questions_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_payment_settings: {
        Row: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          created_at: string
          currency: string
          dues_by_category: Json
          id: string
          instructions: string
          is_active: boolean
          routing_or_swift: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          account_holder?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          currency?: string
          dues_by_category?: Json
          id?: string
          instructions?: string
          is_active?: boolean
          routing_or_swift?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          account_holder?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          currency?: string
          dues_by_category?: Json
          id?: string
          instructions?: string
          is_active?: boolean
          routing_or_swift?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_payment_settings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_payments: {
        Row: {
          amount: number | null
          application_id: string
          category_slug: string
          created_at: string
          currency: string
          id: string
          member_user_id: string
          method: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          receipt_path: string | null
          reference_note: string | null
          status: Database["public"]["Enums"]["membership_payment_status"]
          updated_at: string
          uploaded_by_user_id: string | null
          verified_at: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          amount?: number | null
          application_id: string
          category_slug: string
          created_at?: string
          currency?: string
          id?: string
          member_user_id: string
          method?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          receipt_path?: string | null
          reference_note?: string | null
          status?: Database["public"]["Enums"]["membership_payment_status"]
          updated_at?: string
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          amount?: number | null
          application_id?: string
          category_slug?: string
          created_at?: string
          currency?: string
          id?: string
          member_user_id?: string
          method?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          receipt_path?: string | null
          reference_note?: string | null
          status?: Database["public"]["Enums"]["membership_payment_status"]
          updated_at?: string
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_payments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "institutional_membership_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_payments_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_payments_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_payments_verified_by_user_id_fkey"
            columns: ["verified_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_roles: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          id: string
          membership_id: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          role_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          id?: string
          membership_id: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          id?: string
          membership_id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_roles_assigned_by_user_id_fkey"
            columns: ["assigned_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_roles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_roles_revoked_by_user_id_fkey"
            columns: ["revoked_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tenant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          joined_at: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          actor_user_id: string
          created_at: string
          id: string
          moderation_case_id: string
          note: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          actor_user_id: string
          created_at?: string
          id?: string
          moderation_case_id: string
          note?: string | null
          payload?: Json
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["moderation_action_type"]
          actor_user_id?: string
          created_at?: string
          id?: string
          moderation_case_id?: string
          note?: string | null
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_moderation_case_id_fkey"
            columns: ["moderation_case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          opened_by_user_id: string
          reason: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          status: Database["public"]["Enums"]["moderation_case_status"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          opened_by_user_id: string
          reason: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["moderation_case_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          opened_by_user_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          severity?: string
          status?: Database["public"]["Enums"]["moderation_case_status"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_opened_by_user_id_fkey"
            columns: ["opened_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          delivered_at: string | null
          delivery_status: string
          failed_at: string | null
          id: string
          last_attempt_at: string | null
          notification_id: string
          provider_message_id: string | null
          provider_name: string
          push_subscription_id: string | null
          response_code: number | null
          response_payload: Json
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          failed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          notification_id: string
          provider_message_id?: string | null
          provider_name?: string
          push_subscription_id?: string | null
          response_code?: number | null
          response_payload?: Json
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          failed_at?: string | null
          id?: string
          last_attempt_at?: string | null
          notification_id?: string
          provider_message_id?: string | null
          provider_name?: string
          push_subscription_id?: string | null
          response_code?: number | null
          response_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_push_subscription_id_fkey"
            columns: ["push_subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_logs: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          log_level: string
          message: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          log_level?: string
          message: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          log_level?: string
          message?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_logs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "notification_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          locale: string
          push_enabled: boolean
          quiet_hours_json: Json
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          locale?: string
          push_enabled?: boolean
          quiet_hours_json?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          locale?: string
          push_enabled?: boolean
          quiet_hours_json?: Json
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          clicked_at: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          tenant_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          body: string
          clicked_at?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id: string
          tenant_id?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          body?: string
          clicked_at?: string | null
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          tenant_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_stage_templates: {
        Row: {
          code: string
          color_token: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          position: number
          updated_at: string
        }
        Insert: {
          code: string
          color_token?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          position?: number
          updated_at?: string
        }
        Update: {
          code?: string
          color_token?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      pastor_authority_requests: {
        Row: {
          approved_scope_id: string | null
          association_id: string | null
          church_ids: string[]
          created_at: string
          district_id: string | null
          first_names: string
          id: string
          identity_document_file_path: string
          identity_document_number: string
          last_names: string
          notes: string | null
          pastor_status_attestation: boolean
          phone_number: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at: string
          submitted_form_snapshot: Json
          union_id: string | null
          updated_at: string
        }
        Insert: {
          approved_scope_id?: string | null
          association_id?: string | null
          church_ids?: string[]
          created_at?: string
          district_id?: string | null
          first_names: string
          id?: string
          identity_document_file_path: string
          identity_document_number: string
          last_names: string
          notes?: string | null
          pastor_status_attestation?: boolean
          phone_number: string
          requester_user_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at?: string
          submitted_form_snapshot?: Json
          union_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_scope_id?: string | null
          association_id?: string | null
          church_ids?: string[]
          created_at?: string
          district_id?: string | null
          first_names?: string
          id?: string
          identity_document_file_path?: string
          identity_document_number?: string
          last_names?: string
          notes?: string | null
          pastor_status_attestation?: boolean
          phone_number?: string
          requester_user_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at?: string
          submitted_form_snapshot?: Json
          union_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastor_authority_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "church_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastor_authority_requests_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "church_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastor_authority_requests_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastor_authority_requests_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastor_authority_requests_union_id_fkey"
            columns: ["union_id"]
            isOneToOne: false
            referencedRelation: "church_unions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string
          id: string
          resource: string
          scope: Database["public"]["Enums"]["permission_scope"]
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description: string
          id?: string
          resource: string
          scope: Database["public"]["Enums"]["permission_scope"]
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string
          id?: string
          resource?: string
          scope?: Database["public"]["Enums"]["permission_scope"]
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          code: string
          color_token: string
          created_at: string
          id: string
          is_system: boolean
          name: string
          position: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          color_token?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          position: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          color_token?: string
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          position?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_roles: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_locked: boolean
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          is_locked?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_locked?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device_kind: string | null
          device_label: string | null
          endpoint: string
          id: string
          is_active: boolean
          last_seen_at: string
          locale: string
          p256dh_key: string
          permission_state: string
          tenant_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_kind?: string | null
          device_label?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          locale?: string
          p256dh_key: string
          permission_state?: string
          tenant_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_kind?: string | null
          device_label?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          locale?: string
          p256dh_key?: string
          permission_state?: string
          tenant_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_requests: {
        Row: {
          approved_tenant_id: string | null
          company_country_code: string | null
          company_description: string | null
          company_email: string | null
          company_logo_path: string | null
          company_phone: string | null
          company_website_url: string | null
          created_at: string
          id: string
          request_metadata: Json
          requested_company_legal_name: string | null
          requested_company_name: string
          requested_tenant_kind: Database["public"]["Enums"]["tenant_kind"]
          requested_tenant_slug: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["recruiter_request_status"]
          submitted_at: string
          updated_at: string
          verification_document_path: string | null
        }
        Insert: {
          approved_tenant_id?: string | null
          company_country_code?: string | null
          company_description?: string | null
          company_email?: string | null
          company_logo_path?: string | null
          company_phone?: string | null
          company_website_url?: string | null
          created_at?: string
          id?: string
          request_metadata?: Json
          requested_company_legal_name?: string | null
          requested_company_name: string
          requested_tenant_kind?: Database["public"]["Enums"]["tenant_kind"]
          requested_tenant_slug: string
          requester_user_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["recruiter_request_status"]
          submitted_at?: string
          updated_at?: string
          verification_document_path?: string | null
        }
        Update: {
          approved_tenant_id?: string | null
          company_country_code?: string | null
          company_description?: string | null
          company_email?: string | null
          company_logo_path?: string | null
          company_phone?: string | null
          company_website_url?: string | null
          created_at?: string
          id?: string
          request_metadata?: Json
          requested_company_legal_name?: string | null
          requested_company_name?: string
          requested_tenant_kind?: Database["public"]["Enums"]["tenant_kind"]
          requested_tenant_slug?: string
          requester_user_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["recruiter_request_status"]
          submitted_at?: string
          updated_at?: string
          verification_document_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_requests_approved_tenant_id_fkey"
            columns: ["approved_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_requests_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_requests_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      regional_administrator_authority_requests: {
        Row: {
          admin_scope_type: Database["public"]["Enums"]["authority_scope_type"]
          appointment_document_file_path: string
          approved_scope_id: string | null
          association_id: string | null
          created_at: string
          first_names: string
          id: string
          identity_document_file_path: string
          identity_document_number: string
          last_names: string
          notes: string | null
          phone_number: string
          position_title: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at: string
          submitted_form_snapshot: Json
          union_id: string | null
          updated_at: string
        }
        Insert: {
          admin_scope_type: Database["public"]["Enums"]["authority_scope_type"]
          appointment_document_file_path: string
          approved_scope_id?: string | null
          association_id?: string | null
          created_at?: string
          first_names: string
          id?: string
          identity_document_file_path: string
          identity_document_number: string
          last_names: string
          notes?: string | null
          phone_number: string
          position_title: string
          requester_user_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at?: string
          submitted_form_snapshot?: Json
          union_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_scope_type?: Database["public"]["Enums"]["authority_scope_type"]
          appointment_document_file_path?: string
          approved_scope_id?: string | null
          association_id?: string | null
          created_at?: string
          first_names?: string
          id?: string
          identity_document_file_path?: string
          identity_document_number?: string
          last_names?: string
          notes?: string | null
          phone_number?: string
          position_title?: string
          requester_user_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at?: string
          submitted_form_snapshot?: Json
          union_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_administrator_authority_reque_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_administrator_authority_request_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_administrator_authority_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "church_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regional_administrator_authority_requests_union_id_fkey"
            columns: ["union_id"]
            isOneToOne: false
            referencedRelation: "church_unions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          candidate_profile_id: string
          created_at: string
          id: string
          job_posting_id: string
        }
        Insert: {
          candidate_profile_id: string
          created_at?: string
          id?: string
          job_posting_id: string
        }
        Update: {
          candidate_profile_id?: string
          created_at?: string
          id?: string
          job_posting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_candidate_profile_id_fkey"
            columns: ["candidate_profile_id"]
            isOneToOne: false
            referencedRelation: "candidate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          currency_code: string
          description: string
          id: string
          limits_json: Json
          monthly_price_amount: number
          name: string
          status: Database["public"]["Enums"]["subscription_plan_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency_code?: string
          description?: string
          id?: string
          limits_json?: Json
          monthly_price_amount?: number
          name: string
          status?: Database["public"]["Enums"]["subscription_plan_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency_code?: string
          description?: string
          id?: string
          limits_json?: Json
          monthly_price_amount?: number
          name?: string
          status?: Database["public"]["Enums"]["subscription_plan_status"]
          updated_at?: string
        }
        Relationships: []
      }
      tenant_role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tenant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_roles: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_locked: boolean
          is_system: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          is_locked?: boolean
          is_system?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_locked?: boolean
          is_system?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          plan_id: string
          seat_count: number
          starts_at: string
          status: Database["public"]["Enums"]["tenant_subscription_status"]
          tenant_id: string
          updated_at: string
          usage_snapshot: Json
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id: string
          seat_count?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["tenant_subscription_status"]
          tenant_id: string
          updated_at?: string
          usage_snapshot?: Json
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          plan_id?: string
          seat_count?: number
          starts_at?: string
          status?: Database["public"]["Enums"]["tenant_subscription_status"]
          tenant_id?: string
          updated_at?: string
          usage_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          tenant_kind: Database["public"]["Enums"]["tenant_kind"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          tenant_kind?: Database["public"]["Enums"]["tenant_kind"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          tenant_kind?: Database["public"]["Enums"]["tenant_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_authority_scopes: {
        Row: {
          association_id: string | null
          authority_role: Database["public"]["Enums"]["authority_role_type"]
          church_ids: string[]
          created_at: string
          district_id: string | null
          granted_at: string
          granted_by_user_id: string | null
          id: string
          notes: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          scope_type: Database["public"]["Enums"]["authority_scope_type"]
          source_request_id: string
          source_request_type: string
          status: Database["public"]["Enums"]["authority_scope_status"]
          union_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          association_id?: string | null
          authority_role: Database["public"]["Enums"]["authority_role_type"]
          church_ids?: string[]
          created_at?: string
          district_id?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          scope_type: Database["public"]["Enums"]["authority_scope_type"]
          source_request_id: string
          source_request_type: string
          status?: Database["public"]["Enums"]["authority_scope_status"]
          union_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          association_id?: string | null
          authority_role?: Database["public"]["Enums"]["authority_role_type"]
          church_ids?: string[]
          created_at?: string
          district_id?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          id?: string
          notes?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          scope_type?: Database["public"]["Enums"]["authority_scope_type"]
          source_request_id?: string
          source_request_type?: string
          status?: Database["public"]["Enums"]["authority_scope_status"]
          union_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_authority_scopes_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "church_associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_authority_scopes_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "church_districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_authority_scopes_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_authority_scopes_revoked_by_user_id_fkey"
            columns: ["revoked_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_authority_scopes_union_id_fkey"
            columns: ["union_id"]
            isOneToOne: false
            referencedRelation: "church_unions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_authority_scopes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_platform_roles: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          id: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          id?: string
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_platform_roles_assigned_by_user_id_fkey"
            columns: ["assigned_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_platform_roles_revoked_by_user_id_fkey"
            columns: ["revoked_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_platform_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "platform_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_platform_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          approval_reviewed_at: string | null
          approval_reviewed_by_user_id: string | null
          asi_membership_status: Database["public"]["Enums"]["asi_membership_status"]
          avatar_path: string | null
          country_code: string | null
          created_at: string
          display_name: string
          email: string | null
          full_name: string
          id: string
          is_internal_developer: boolean
          last_sign_in_at: string | null
          locale: string | null
          manual_access_override_by_user_id: string | null
          manual_access_override_reason: string | null
          manual_access_override_until: string | null
          membership_expires_at: string | null
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          subscription_expires_at: string | null
          updated_at: string
          user_approval_status: Database["public"]["Enums"]["user_approval_status"]
          user_subscription_status: Database["public"]["Enums"]["user_subscription_status"]
        }
        Insert: {
          approval_reviewed_at?: string | null
          approval_reviewed_by_user_id?: string | null
          asi_membership_status?: Database["public"]["Enums"]["asi_membership_status"]
          avatar_path?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          full_name?: string
          id: string
          is_internal_developer?: boolean
          last_sign_in_at?: string | null
          locale?: string | null
          manual_access_override_by_user_id?: string | null
          manual_access_override_reason?: string | null
          manual_access_override_until?: string | null
          membership_expires_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          subscription_expires_at?: string | null
          updated_at?: string
          user_approval_status?: Database["public"]["Enums"]["user_approval_status"]
          user_subscription_status?: Database["public"]["Enums"]["user_subscription_status"]
        }
        Update: {
          approval_reviewed_at?: string | null
          approval_reviewed_by_user_id?: string | null
          asi_membership_status?: Database["public"]["Enums"]["asi_membership_status"]
          avatar_path?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          full_name?: string
          id?: string
          is_internal_developer?: boolean
          last_sign_in_at?: string | null
          locale?: string | null
          manual_access_override_by_user_id?: string | null
          manual_access_override_reason?: string | null
          manual_access_override_until?: string | null
          membership_expires_at?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          subscription_expires_at?: string | null
          updated_at?: string
          user_approval_status?: Database["public"]["Enums"]["user_approval_status"]
          user_subscription_status?: Database["public"]["Enums"]["user_subscription_status"]
        }
        Relationships: [
          {
            foreignKeyName: "users_approval_reviewed_by_user_id_fkey"
            columns: ["approval_reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manual_access_override_by_user_id_fkey"
            columns: ["manual_access_override_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_member: {
        Args: {
          p_application_id: string
          p_membership_months?: number
          p_notes?: string
        }
        Returns: {
          approval_reviewed_at: string | null
          approval_reviewed_by_user_id: string | null
          asi_membership_status: Database["public"]["Enums"]["asi_membership_status"]
          avatar_path: string | null
          country_code: string | null
          created_at: string
          display_name: string
          email: string | null
          full_name: string
          id: string
          is_internal_developer: boolean
          last_sign_in_at: string | null
          locale: string | null
          manual_access_override_by_user_id: string | null
          manual_access_override_reason: string | null
          manual_access_override_until: string | null
          membership_expires_at: string | null
          phone: string | null
          status: Database["public"]["Enums"]["user_status"]
          subscription_expires_at: string | null
          updated_at: string
          user_approval_status: Database["public"]["Enums"]["user_approval_status"]
          user_subscription_status: Database["public"]["Enums"]["user_subscription_status"]
        }
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_moderation_action: {
        Args: {
          p_action_type: Database["public"]["Enums"]["moderation_action_type"]
          p_case_id: string
          p_note?: string
        }
        Returns: {
          assigned_to_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          opened_by_user_id: string
          reason: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          status: Database["public"]["Enums"]["moderation_case_status"]
          tenant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "moderation_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bootstrap_first_platform_owner: {
        Args: never
        Returns: {
          assigned_at: string
          assigned_by_user_id: string | null
          id: string
          revoked_at: string | null
          revoked_by_user_id: string | null
          role_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_platform_roles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_internal_console: { Args: never; Returns: boolean }
      can_publish_opportunity: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      can_read_application: {
        Args: { p_application_id: string }
        Returns: boolean
      }
      get_candidate_profile_for_tenant: {
        Args: { p_candidate_profile_id: string; p_tenant_id: string }
        Returns: Json
      }
      get_plan_limit_json: { Args: { p_tenant_id: string }; Returns: Json }
      get_tenant_plan_snapshot: { Args: { p_tenant_id: string }; Returns: Json }
      has_active_asi_access: { Args: { p_user_id?: string }; Returns: boolean }
      has_active_authority_scope: {
        Args: {
          p_association_id?: string
          p_church_id?: string
          p_district_id?: string
          p_role: Database["public"]["Enums"]["authority_role_type"]
          p_union_id?: string
        }
        Returns: boolean
      }
      has_active_tenant_subscription: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      email_test_send: {
        Args: {
          p_to: string
          p_subject: string
          p_message: string
          p_simulate?: string
        }
        Returns: string
      }
      email_test_force_status: {
        Args: { p_delivery_id: string; p_status: string }
        Returns: undefined
      }
      email_test_clear: {
        Args: Record<string, never>
        Returns: number
      }
      email_resend_delivery: {
        Args: { p_delivery_id: string }
        Returns: undefined
      }
      trigger_email_dispatch: {
        Args: Record<string, never>
        Returns: undefined
      }
      has_platform_permission: {
        Args: { permission_code: string }
        Returns: boolean
      }
      has_tenant_permission: {
        Args: { p_tenant_id: string; permission_code: string }
        Returns: boolean
      }
      invite_tenant_member: {
        Args: { p_email: string; p_role_id?: string; p_tenant_id: string }
        Returns: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          joined_at: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_candidate_profile_owner: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
      mark_notification_clicked: {
        Args: { p_delivery_id?: string; p_notification_id: string }
        Returns: {
          action_url: string | null
          body: string
          clicked_at: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          tenant_id: string | null
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: {
          action_url: string | null
          body: string
          clicked_at: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          tenant_id: string | null
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_notification_unread: {
        Args: { p_notification_id: string }
        Returns: {
          action_url: string | null
          body: string
          clicked_at: string | null
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          tenant_id: string | null
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_application_stage: {
        Args: {
          p_application_id: string
          p_note?: string
          p_to_stage_id: string
        }
        Returns: {
          candidate_display_name_snapshot: string
          candidate_email_snapshot: string | null
          candidate_headline_snapshot: string | null
          candidate_profile_id: string
          candidate_summary_snapshot: string | null
          cover_letter: string | null
          created_at: string
          current_stage_id: string | null
          id: string
          job_posting_id: string
          status_public: Database["public"]["Enums"]["application_public_status"]
          submitted_at: string
          submitted_resume_filename: string | null
          submitted_resume_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_tenant_ids: { Args: never; Returns: string[] }
      open_moderation_case: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_reason?: string
          p_severity?: string
          p_tenant_id?: string
        }
        Returns: {
          assigned_to_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          opened_by_user_id: string
          reason: string
          resolved_at: string | null
          resolved_by_user_id: string | null
          severity: string
          status: Database["public"]["Enums"]["moderation_case_status"]
          tenant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "moderation_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pastor_user_for_church: { Args: { p_church_id: string }; Returns: string }
      platform_ops_snapshot: { Args: never; Returns: Json }
      queue_push_notification: {
        Args: {
          p_action_url?: string
          p_body: string
          p_payload?: Json
          p_recipient_user_id: string
          p_tenant_id?: string
          p_title: string
          p_type: string
        }
        Returns: {
          auth_key: string
          notification_action_url: string
          notification_body: string
          notification_id: string
          notification_payload: Json
          notification_title: string
          p256dh_key: string
          push_delivery_id: string
          push_subscription_id: string
          subscription_endpoint: string
          subscription_locale: string
        }[]
      }
      register_push_subscription: {
        Args: {
          p_auth_key: string
          p_device_kind?: string
          p_device_label?: string
          p_endpoint: string
          p_locale?: string
          p_p256dh_key: string
          p_tenant_id?: string
          p_user_agent?: string
        }
        Returns: {
          auth_key: string
          created_at: string
          device_kind: string | null
          device_label: string | null
          endpoint: string
          id: string
          is_active: boolean
          last_seen_at: string
          locale: string
          p256dh_key: string
          permission_state: string
          tenant_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_membership_application: {
        Args: {
          p_application_id: string
          p_decision: Database["public"]["Enums"]["review_workflow_status"]
          p_pastoral_reference?: Database["public"]["Enums"]["pastoral_reference_status"]
          p_review_notes?: string
        }
        Returns: {
          applicant_email: string
          applicant_first_name: string
          applicant_last_name: string
          applicant_phone: string
          assigned_pastor_user_id: string | null
          assigned_queue: Database["public"]["Enums"]["membership_application_queue"]
          category_name: string
          category_slug: string
          church_city: string
          church_id: string | null
          church_state_province: string
          conference_name: string
          created_at: string
          dues: string
          eligibility_snapshot: Json
          home_church_name: string
          id: string
          pastor_email: string
          pastor_name: string
          pastor_phone: string
          pastoral_reference_status: Database["public"]["Enums"]["pastoral_reference_status"]
          requester_user_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at: string
          submitted_form_snapshot: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "institutional_membership_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_membership_application: {
        Args: {
          p_application_id: string
          p_response_note?: string
        }
        Returns: {
          applicant_email: string
          applicant_first_name: string
          applicant_last_name: string
          applicant_phone: string
          assigned_pastor_user_id: string | null
          assigned_queue: Database["public"]["Enums"]["membership_application_queue"]
          category_name: string
          category_slug: string
          church_city: string
          church_id: string | null
          church_state_province: string
          conference_name: string
          created_at: string
          dues: string
          eligibility_snapshot: Json
          home_church_name: string
          id: string
          pastor_email: string
          pastor_name: string
          pastor_phone: string
          pastoral_reference_status: Database["public"]["Enums"]["pastoral_reference_status"]
          requester_user_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at: string
          submitted_form_snapshot: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "institutional_membership_applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_pastor_authority_request: {
        Args: {
          p_decision: Database["public"]["Enums"]["review_workflow_status"]
          p_request_id: string
          p_review_notes?: string
        }
        Returns: {
          approved_scope_id: string | null
          association_id: string | null
          church_ids: string[]
          created_at: string
          district_id: string | null
          first_names: string
          id: string
          identity_document_file_path: string
          identity_document_number: string
          last_names: string
          notes: string | null
          pastor_status_attestation: boolean
          phone_number: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at: string
          submitted_form_snapshot: Json
          union_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "pastor_authority_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_recruiter_request: {
        Args: {
          p_decision: Database["public"]["Enums"]["recruiter_request_status"]
          p_request_id: string
          p_review_notes?: string
        }
        Returns: {
          approved_tenant_id: string | null
          company_country_code: string | null
          company_description: string | null
          company_email: string | null
          company_logo_path: string | null
          company_phone: string | null
          company_website_url: string | null
          created_at: string
          id: string
          request_metadata: Json
          requested_company_legal_name: string | null
          requested_company_name: string
          requested_tenant_kind: Database["public"]["Enums"]["tenant_kind"]
          requested_tenant_slug: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["recruiter_request_status"]
          submitted_at: string
          updated_at: string
          verification_document_path: string | null
        }
        SetofOptions: {
          from: "*"
          to: "recruiter_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_regional_authority_request: {
        Args: {
          p_decision: Database["public"]["Enums"]["review_workflow_status"]
          p_request_id: string
          p_review_notes?: string
        }
        Returns: {
          admin_scope_type: Database["public"]["Enums"]["authority_scope_type"]
          appointment_document_file_path: string
          approved_scope_id: string | null
          association_id: string | null
          created_at: string
          first_names: string
          id: string
          identity_document_file_path: string
          identity_document_number: string
          last_names: string
          notes: string | null
          phone_number: string
          position_title: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database["public"]["Enums"]["review_workflow_status"]
          submitted_at: string
          submitted_form_snapshot: Json
          union_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "regional_administrator_authority_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_membership_invite: {
        Args: { p_membership_id: string }
        Returns: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          joined_at: string
          status: Database["public"]["Enums"]["membership_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_candidate_profiles: {
        Args: {
          p_country_code?: string
          p_language?: string
          p_limit?: number
          p_query?: string
          p_skill?: string
          p_tenant_id: string
        }
        Returns: {
          avatar_path: string
          candidate_profile_id: string
          city_name: string
          completeness_score: number
          country_code: string
          desired_role: string
          display_name: string
          full_name: string
          headline: string
          language_names: string[]
          latest_role_title: string
          skill_names: string[]
          summary: string
          total_experiences: number
          user_id: string
        }[]
      }
      submit_application: {
        Args: {
          p_answers?: Json
          p_cover_letter?: string
          p_job_posting_id: string
          p_submitted_resume_id?: string
        }
        Returns: {
          candidate_display_name_snapshot: string
          candidate_email_snapshot: string | null
          candidate_headline_snapshot: string | null
          candidate_profile_id: string
          candidate_summary_snapshot: string | null
          cover_letter: string | null
          created_at: string
          current_stage_id: string | null
          id: string
          job_posting_id: string
          status_public: Database["public"]["Enums"]["application_public_status"]
          submitted_at: string
          submitted_resume_filename: string | null
          submitted_resume_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sync_application_public_status_from_stage: {
        Args: { stage_code: string }
        Returns: Database["public"]["Enums"]["application_public_status"]
      }
      system_create_notification: {
        Args: {
          p_action_url?: string
          p_body: string
          p_payload?: Json
          p_recipient_user_id: string
          p_tenant_id?: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      update_push_delivery_status: {
        Args: {
          p_deactivate_subscription?: boolean
          p_delivery_id: string
          p_delivery_status: string
          p_log_level?: string
          p_log_message?: string
          p_permission_state?: string
          p_provider_message_id?: string
          p_response_code?: number
          p_response_payload?: Json
        }
        Returns: {
          attempt_count: number
          channel: string
          created_at: string
          delivered_at: string | null
          delivery_status: string
          failed_at: string | null
          id: string
          last_attempt_at: string | null
          notification_id: string
          provider_message_id: string | null
          provider_name: string
          push_subscription_id: string | null
          response_code: number | null
          response_payload: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_notification_preferences: {
        Args: {
          p_email_enabled?: boolean
          p_in_app_enabled?: boolean
          p_locale?: string
          p_push_enabled?: boolean
          p_quiet_hours_json?: Json
          p_tenant_id?: string
        }
        Returns: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          locale: string
          push_enabled: boolean
          quiet_hours_json: Json
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_membership_payment: {
        Args: {
          p_decision: Database["public"]["Enums"]["membership_payment_status"]
          p_notes?: string
          p_payment_id: string
        }
        Returns: {
          amount: number | null
          application_id: string
          category_slug: string
          created_at: string
          currency: string
          id: string
          member_user_id: string
          method: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          receipt_path: string | null
          reference_note: string | null
          status: Database["public"]["Enums"]["membership_payment_status"]
          updated_at: string
          uploaded_by_user_id: string | null
          verified_at: string | null
          verified_by_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "membership_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      application_public_status:
        | "submitted"
        | "in_review"
        | "interviewing"
        | "offer"
        | "rejected"
        | "withdrawn"
        | "hired"
      asi_membership_status:
        | "none"
        | "pending"
        | "active"
        | "grace_period"
        | "expired"
        | "suspended"
        | "revoked"
      authority_role_type: "pastor_administrator" | "regional_administrator"
      authority_scope_status: "active" | "revoked"
      authority_scope_type: "union" | "association" | "district" | "church"
      feature_scope_type: "global" | "plan" | "tenant"
      job_employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "temporary"
        | "internship"
      job_posting_status: "draft" | "published" | "closed" | "archived"
      job_screening_answer_type:
        | "short_text"
        | "long_text"
        | "yes_no"
        | "single_select"
      job_workplace_type: "on_site" | "hybrid" | "remote"
      membership_application_queue: "pastor" | "admin"
      membership_payment_status: "submitted" | "verified" | "rejected"
      membership_status: "active" | "invited" | "suspended" | "revoked"
      moderation_action_type:
        | "note"
        | "warn"
        | "close_job"
        | "suspend_tenant"
        | "restore_tenant"
        | "dismiss_case"
      moderation_case_status: "open" | "under_review" | "resolved" | "dismissed"
      opportunity_compensation_type:
        | "salary"
        | "stipend"
        | "budget"
        | "unpaid"
        | "donation_based"
        | "not_disclosed"
      opportunity_type:
        | "employment"
        | "project"
        | "volunteer"
        | "professional_service"
      pastoral_reference_status:
        | "pending"
        | "contacted"
        | "endorsed"
        | "declined"
        | "waived"
      permission_scope: "platform" | "tenant" | "self"
      recruiter_request_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "cancelled"
      review_workflow_status:
        | "submitted"
        | "under_review"
        | "needs_more_info"
        | "approved"
        | "rejected"
        | "cancelled"
      subscription_plan_status: "draft" | "active" | "archived"
      tenant_kind:
        | "company"
        | "ministry"
        | "project"
        | "field"
        | "generic_profile"
      tenant_status: "active" | "suspended" | "archived"
      tenant_subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "cancelled"
        | "ended"
      user_approval_status:
        | "pending_review"
        | "needs_more_info"
        | "approved"
        | "rejected"
        | "suspended"
        | "revoked"
      user_status: "active" | "suspended" | "blocked"
      user_subscription_status:
        | "none"
        | "trialing"
        | "active"
        | "past_due"
        | "grace_period"
        | "cancelled"
        | "ended"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    // Supabase generates this union even when the default schema has no composite types.
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_public_status: [
        "submitted",
        "in_review",
        "interviewing",
        "offer",
        "rejected",
        "withdrawn",
        "hired",
      ],
      asi_membership_status: [
        "none",
        "pending",
        "active",
        "grace_period",
        "expired",
        "suspended",
        "revoked",
      ],
      authority_role_type: ["pastor_administrator", "regional_administrator"],
      authority_scope_status: ["active", "revoked"],
      authority_scope_type: ["union", "association", "district", "church"],
      feature_scope_type: ["global", "plan", "tenant"],
      job_employment_type: [
        "full_time",
        "part_time",
        "contract",
        "temporary",
        "internship",
      ],
      job_posting_status: ["draft", "published", "closed", "archived"],
      job_screening_answer_type: [
        "short_text",
        "long_text",
        "yes_no",
        "single_select",
      ],
      job_workplace_type: ["on_site", "hybrid", "remote"],
      membership_application_queue: ["pastor", "admin"],
      membership_payment_status: ["submitted", "verified", "rejected"],
      membership_status: ["active", "invited", "suspended", "revoked"],
      moderation_action_type: [
        "note",
        "warn",
        "close_job",
        "suspend_tenant",
        "restore_tenant",
        "dismiss_case",
      ],
      moderation_case_status: ["open", "under_review", "resolved", "dismissed"],
      opportunity_compensation_type: [
        "salary",
        "stipend",
        "budget",
        "unpaid",
        "donation_based",
        "not_disclosed",
      ],
      opportunity_type: [
        "employment",
        "project",
        "volunteer",
        "professional_service",
      ],
      pastoral_reference_status: [
        "pending",
        "contacted",
        "endorsed",
        "declined",
        "waived",
      ],
      permission_scope: ["platform", "tenant", "self"],
      recruiter_request_status: [
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "cancelled",
      ],
      review_workflow_status: [
        "submitted",
        "under_review",
        "needs_more_info",
        "approved",
        "rejected",
        "cancelled",
      ],
      subscription_plan_status: ["draft", "active", "archived"],
      tenant_kind: [
        "company",
        "ministry",
        "project",
        "field",
        "generic_profile",
      ],
      tenant_status: ["active", "suspended", "archived"],
      tenant_subscription_status: [
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "ended",
      ],
      user_approval_status: [
        "pending_review",
        "needs_more_info",
        "approved",
        "rejected",
        "suspended",
        "revoked",
      ],
      user_status: ["active", "suspended", "blocked"],
      user_subscription_status: [
        "none",
        "trialing",
        "active",
        "past_due",
        "grace_period",
        "cancelled",
        "ended",
      ],
    },
  },
} as const
