/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.4'
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
          severity: Database['public']['Enums']['app_error_severity']
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
          severity?: Database['public']['Enums']['app_error_severity']
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
          severity?: Database['public']['Enums']['app_error_severity']
          source?: string
          updated_at?: string
          user_id?: string | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: 'app_error_logs_resolved_by_user_id_fkey'
            columns: ['resolved_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'app_error_logs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'application_answers_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_answers_screening_question_id_fkey'
            columns: ['screening_question_id']
            isOneToOne: false
            referencedRelation: 'job_screening_questions'
            referencedColumns: ['id']
          }
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
          status_public: Database['public']['Enums']['application_public_status']
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
          status_public?: Database['public']['Enums']['application_public_status']
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
          status_public?: Database['public']['Enums']['application_public_status']
          submitted_at?: string
          submitted_resume_filename?: string | null
          submitted_resume_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'applications_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_current_stage_id_fkey'
            columns: ['current_stage_id']
            isOneToOne: false
            referencedRelation: 'pipeline_stages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_job_posting_id_fkey'
            columns: ['job_posting_id']
            isOneToOne: false
            referencedRelation: 'job_postings'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_submitted_resume_id_fkey'
            columns: ['submitted_resume_id']
            isOneToOne: false
            referencedRelation: 'candidate_resumes'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'application_notes_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_notes_author_user_id_fkey'
            columns: ['author_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      application_ratings: {
        Row: {
          application_id: string
          author_user_id: string
          created_at: string
          id: string
          rubric_json: Json | null
          score: number
          updated_at: string
        }
        Insert: {
          application_id: string
          author_user_id: string
          created_at?: string
          id?: string
          rubric_json?: Json | null
          score: number
          updated_at?: string
        }
        Update: {
          application_id?: string
          author_user_id?: string
          created_at?: string
          id?: string
          rubric_json?: Json | null
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'application_ratings_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_ratings_author_user_id_fkey'
            columns: ['author_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'application_stage_history_application_id_fkey'
            columns: ['application_id']
            isOneToOne: false
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_stage_history_changed_by_user_id_fkey'
            columns: ['changed_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_stage_history_from_stage_id_fkey'
            columns: ['from_stage_id']
            isOneToOne: false
            referencedRelation: 'pipeline_stages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_stage_history_to_stage_id_fkey'
            columns: ['to_stage_id']
            isOneToOne: false
            referencedRelation: 'pipeline_stages'
            referencedColumns: ['id']
          }
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
          scope_type: Database['public']['Enums']['feature_scope_type']
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
          scope_type?: Database['public']['Enums']['feature_scope_type']
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
          scope_type?: Database['public']['Enums']['feature_scope_type']
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          payload: Json
          tenant_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          payload?: Json
          tenant_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          payload?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'candidate_educations_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'candidate_experiences_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'candidate_languages_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'candidate_links_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          }
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
          visibility_updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'candidate_profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'candidate_resumes_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'candidate_skills_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          }
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
          size_range?: string | null
          tenant_id?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'company_profiles_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: true
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'job_alerts_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      job_postings: {
        Row: {
          archived_at: string | null
          city_name: string | null
          closed_at: string | null
          company_profile_id: string
          country_code: string | null
          created_at: string
          created_by_user_id: string | null
          description: string
          employment_type: Database['public']['Enums']['job_employment_type']
          experience_level: string | null
          expires_at: string | null
          id: string
          is_featured: boolean
          published_at: string | null
          salary_currency: string | null
          salary_max_amount: number | null
          salary_min_amount: number | null
          salary_visible: boolean
          slug: string
          status: Database['public']['Enums']['job_posting_status']
          summary: string
          tenant_id: string
          title: string
          updated_at: string
          workplace_type: Database['public']['Enums']['job_workplace_type']
        }
        Insert: {
          archived_at?: string | null
          city_name?: string | null
          closed_at?: string | null
          company_profile_id: string
          country_code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description: string
          employment_type?: Database['public']['Enums']['job_employment_type']
          experience_level?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean
          published_at?: string | null
          salary_currency?: string | null
          salary_max_amount?: number | null
          salary_min_amount?: number | null
          salary_visible?: boolean
          slug: string
          status?: Database['public']['Enums']['job_posting_status']
          summary: string
          tenant_id: string
          title: string
          updated_at?: string
          workplace_type?: Database['public']['Enums']['job_workplace_type']
        }
        Update: {
          archived_at?: string | null
          city_name?: string | null
          closed_at?: string | null
          company_profile_id?: string
          country_code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          employment_type?: Database['public']['Enums']['job_employment_type']
          experience_level?: string | null
          expires_at?: string | null
          id?: string
          is_featured?: boolean
          published_at?: string | null
          salary_currency?: string | null
          salary_max_amount?: number | null
          salary_min_amount?: number | null
          salary_visible?: boolean
          slug?: string
          status?: Database['public']['Enums']['job_posting_status']
          summary?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          workplace_type?: Database['public']['Enums']['job_workplace_type']
        }
        Relationships: [
          {
            foreignKeyName: 'job_postings_company_profile_id_fkey'
            columns: ['company_profile_id']
            isOneToOne: false
            referencedRelation: 'company_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_postings_created_by_user_id_fkey'
            columns: ['created_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'job_postings_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
      }
      job_screening_questions: {
        Row: {
          answer_type: Database['public']['Enums']['job_screening_answer_type']
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
          answer_type?: Database['public']['Enums']['job_screening_answer_type']
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
          answer_type?: Database['public']['Enums']['job_screening_answer_type']
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
            foreignKeyName: 'job_screening_questions_job_posting_id_fkey'
            columns: ['job_posting_id']
            isOneToOne: false
            referencedRelation: 'job_postings'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'membership_roles_assigned_by_user_id_fkey'
            columns: ['assigned_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'membership_roles_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
            referencedRelation: 'memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'membership_roles_revoked_by_user_id_fkey'
            columns: ['revoked_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'membership_roles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'tenant_roles'
            referencedColumns: ['id']
          }
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          joined_at: string
          status: Database['public']['Enums']['membership_status']
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          status?: Database['public']['Enums']['membership_status']
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          status?: Database['public']['Enums']['membership_status']
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_invited_by_user_id_fkey'
            columns: ['invited_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      moderation_actions: {
        Row: {
          action_type: Database['public']['Enums']['moderation_action_type']
          actor_user_id: string
          created_at: string
          id: string
          moderation_case_id: string
          note: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          action_type: Database['public']['Enums']['moderation_action_type']
          actor_user_id: string
          created_at?: string
          id?: string
          moderation_case_id: string
          note?: string | null
          payload?: Json
          updated_at?: string
        }
        Update: {
          action_type?: Database['public']['Enums']['moderation_action_type']
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
            foreignKeyName: 'moderation_actions_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'moderation_actions_moderation_case_id_fkey'
            columns: ['moderation_case_id']
            isOneToOne: false
            referencedRelation: 'moderation_cases'
            referencedColumns: ['id']
          }
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
          status: Database['public']['Enums']['moderation_case_status']
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
          status?: Database['public']['Enums']['moderation_case_status']
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
          status?: Database['public']['Enums']['moderation_case_status']
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'moderation_cases_assigned_to_user_id_fkey'
            columns: ['assigned_to_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'moderation_cases_opened_by_user_id_fkey'
            columns: ['opened_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'moderation_cases_resolved_by_user_id_fkey'
            columns: ['resolved_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'moderation_cases_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
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
          scope: Database['public']['Enums']['permission_scope']
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description: string
          id?: string
          resource: string
          scope: Database['public']['Enums']['permission_scope']
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string
          id?: string
          resource?: string
          scope?: Database['public']['Enums']['permission_scope']
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
            foreignKeyName: 'pipeline_stages_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'platform_role_permissions_permission_id_fkey'
            columns: ['permission_id']
            isOneToOne: false
            referencedRelation: 'permissions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'platform_role_permissions_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'platform_roles'
            referencedColumns: ['id']
          }
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
          requested_company_legal_name: string | null
          requested_company_name: string
          requested_tenant_slug: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database['public']['Enums']['recruiter_request_status']
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
          requested_company_legal_name?: string | null
          requested_company_name: string
          requested_tenant_slug: string
          requester_user_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database['public']['Enums']['recruiter_request_status']
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
          requested_company_legal_name?: string | null
          requested_company_name?: string
          requested_tenant_slug?: string
          requester_user_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: Database['public']['Enums']['recruiter_request_status']
          submitted_at?: string
          updated_at?: string
          verification_document_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'recruiter_requests_approved_tenant_id_fkey'
            columns: ['approved_tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recruiter_requests_requester_user_id_fkey'
            columns: ['requester_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recruiter_requests_reviewed_by_user_id_fkey'
            columns: ['reviewed_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'saved_jobs_candidate_profile_id_fkey'
            columns: ['candidate_profile_id']
            isOneToOne: false
            referencedRelation: 'candidate_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'saved_jobs_job_posting_id_fkey'
            columns: ['job_posting_id']
            isOneToOne: false
            referencedRelation: 'job_postings'
            referencedColumns: ['id']
          }
        ]
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
            foreignKeyName: 'tenant_role_permissions_permission_id_fkey'
            columns: ['permission_id']
            isOneToOne: false
            referencedRelation: 'permissions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tenant_role_permissions_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'tenant_roles'
            referencedColumns: ['id']
          }
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
            foreignKeyName: 'tenant_roles_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
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
          status: Database['public']['Enums']['tenant_subscription_status']
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
          status?: Database['public']['Enums']['tenant_subscription_status']
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
          status?: Database['public']['Enums']['tenant_subscription_status']
          tenant_id?: string
          updated_at?: string
          usage_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'tenant_subscriptions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'subscription_plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tenant_subscriptions_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
          slug: string
          status: Database['public']['Enums']['tenant_status']
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name: string
          slug: string
          status?: Database['public']['Enums']['tenant_status']
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database['public']['Enums']['tenant_status']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tenants_created_by_user_id_fkey'
            columns: ['created_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
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
          status: Database['public']['Enums']['subscription_plan_status']
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
          status?: Database['public']['Enums']['subscription_plan_status']
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
          status?: Database['public']['Enums']['subscription_plan_status']
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: 'user_platform_roles_assigned_by_user_id_fkey'
            columns: ['assigned_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_platform_roles_revoked_by_user_id_fkey'
            columns: ['revoked_by_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_platform_roles_role_id_fkey'
            columns: ['role_id']
            isOneToOne: false
            referencedRelation: 'platform_roles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_platform_roles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      users: {
        Row: {
          avatar_path: string | null
          country_code: string | null
          created_at: string
          display_name: string
          email: string | null
          full_name: string
          id: string
          last_sign_in_at: string | null
          locale: string | null
          phone: string | null
          status: Database['public']['Enums']['user_status']
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          full_name?: string
          id: string
          last_sign_in_at?: string | null
          locale?: string | null
          phone?: string | null
          status?: Database['public']['Enums']['user_status']
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          country_code?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          full_name?: string
          id?: string
          last_sign_in_at?: string | null
          locale?: string | null
          phone?: string | null
          status?: Database['public']['Enums']['user_status']
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
          from: '*'
          to: 'user_platform_roles'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_platform_permission: {
        Args: { permission_code: string }
        Returns: boolean
      }
      has_tenant_permission: {
        Args: { p_tenant_id: string; permission_code: string }
        Returns: boolean
      }
      is_platform_admin: {
        Args: never
        Returns: boolean
      }
      is_tenant_member: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      my_tenant_ids: {
        Args: never
        Returns: string[]
      }
      apply_moderation_action: {
        Args: {
          p_action_type: Database['public']['Enums']['moderation_action_type']
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
          status: Database['public']['Enums']['moderation_case_status']
          tenant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'moderation_cases'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_tenant_plan_snapshot: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      review_recruiter_request: {
        Args: {
          p_decision: Database['public']['Enums']['recruiter_request_status']
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
          requested_company_legal_name: string | null
          requested_company_name: string
          requested_tenant_slug: string
          requester_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: Database['public']['Enums']['recruiter_request_status']
          submitted_at: string
          updated_at: string
          verification_document_path: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'recruiter_requests'
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
          status: Database['public']['Enums']['moderation_case_status']
          tenant_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'moderation_cases'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      platform_ops_snapshot: {
        Args: never
        Returns: Json
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
          status_public: Database['public']['Enums']['application_public_status']
          submitted_at: string
          submitted_resume_filename: string | null
          submitted_resume_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'applications'
          isOneToOne: true
          isSetofReturn: false
        }
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
    }
    Enums: {
      application_public_status: 'submitted' | 'in_review' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn' | 'hired'
      app_error_severity: 'info' | 'warning' | 'error' | 'fatal'
      feature_scope_type: 'global' | 'plan' | 'tenant'
      job_employment_type: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship'
      job_posting_status: 'draft' | 'published' | 'closed' | 'archived'
      job_screening_answer_type: 'short_text' | 'long_text' | 'yes_no' | 'single_select'
      job_workplace_type: 'on_site' | 'hybrid' | 'remote'
      membership_status: 'active' | 'invited' | 'suspended' | 'revoked'
      moderation_action_type: 'note' | 'warn' | 'close_job' | 'suspend_tenant' | 'restore_tenant' | 'dismiss_case'
      moderation_case_status: 'open' | 'under_review' | 'resolved' | 'dismissed'
      permission_scope: 'platform' | 'tenant' | 'self'
      recruiter_request_status:
        | 'submitted'
        | 'under_review'
        | 'approved'
        | 'rejected'
        | 'cancelled'
      subscription_plan_status: 'draft' | 'active' | 'archived'
      tenant_status: 'active' | 'suspended' | 'archived'
      tenant_subscription_status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'ended'
      user_status: 'active' | 'suspended' | 'blocked'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer Row
    }
    ? Row
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer Row
      }
      ? Row
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer Insert
    }
    ? Insert
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer Insert
      }
      ? Insert
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer Update
    }
    ? Update
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer Update
      }
      ? Update
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      application_public_status: ['submitted', 'in_review', 'interviewing', 'offer', 'rejected', 'withdrawn', 'hired'],
      job_employment_type: ['full_time', 'part_time', 'contract', 'temporary', 'internship'],
      job_posting_status: ['draft', 'published', 'closed', 'archived'],
      job_screening_answer_type: ['short_text', 'long_text', 'yes_no', 'single_select'],
      job_workplace_type: ['on_site', 'hybrid', 'remote'],
      membership_status: ['active', 'invited', 'suspended', 'revoked'],
      permission_scope: ['platform', 'tenant', 'self'],
      recruiter_request_status: ['submitted', 'under_review', 'approved', 'rejected', 'cancelled'],
      tenant_status: ['active', 'suspended', 'archived'],
      user_status: ['active', 'suspended', 'blocked']
    }
  }
} as const
