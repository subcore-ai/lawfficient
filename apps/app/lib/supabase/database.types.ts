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
      audit_log: {
        Row: {
          action: string
          at: string
          by_user_id: string | null
          entity: Database["public"]["Enums"]["audit_entity"]
          entity_id: string
          firm_id: string
          id: string
          label: string
        }
        Insert: {
          action: string
          at?: string
          by_user_id?: string | null
          entity: Database["public"]["Enums"]["audit_entity"]
          entity_id: string
          firm_id?: string
          id?: string
          label?: string
        }
        Update: {
          action?: string
          at?: string
          by_user_id?: string | null
          entity?: Database["public"]["Enums"]["audit_entity"]
          entity_id?: string
          firm_id?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_by_user_id_fkey"
            columns: ["by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tasks: {
        Row: {
          assignee_id: string | null
          case_id: string | null
          due_label: string
          firm_id: string
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Insert: {
          assignee_id?: string | null
          case_id?: string | null
          due_label?: string
          firm_id?: string
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          assignee_id?: string | null
          case_id?: string | null
          due_label?: string
          firm_id?: string
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "immigration_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_tasks_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived: boolean
          balance: number
          case_type: string
          date_hired: string
          firm_id: string
          id: string
          la_id: string | null
          lead_id: string | null
          name: string
          paid: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["client_status"]
          total_fees: number
        }
        Insert: {
          archived?: boolean
          balance?: number
          case_type: string
          date_hired?: string
          firm_id?: string
          id?: string
          la_id?: string | null
          lead_id?: string | null
          name: string
          paid?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["client_status"]
          total_fees?: number
        }
        Update: {
          archived?: boolean
          balance?: number
          case_type?: string
          date_hired?: string
          firm_id?: string
          id?: string
          la_id?: string | null
          lead_id?: string | null
          name?: string
          paid?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          status?: Database["public"]["Enums"]["client_status"]
          total_fees?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_la_id_fkey"
            columns: ["la_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          amount: number | null
          archived: boolean
          attorney_id: string | null
          booked_by_id: string | null
          case_type: string | null
          duration_min: number
          firm_id: string
          id: string
          lead_id: string | null
          lead_name: string
          paid: boolean
          start_at: string
          status: Database["public"]["Enums"]["consultation_status"]
          time_zone: string
          type: string
        }
        Insert: {
          amount?: number | null
          archived?: boolean
          attorney_id?: string | null
          booked_by_id?: string | null
          case_type?: string | null
          duration_min?: number
          firm_id?: string
          id?: string
          lead_id?: string | null
          lead_name: string
          paid?: boolean
          start_at: string
          status?: Database["public"]["Enums"]["consultation_status"]
          time_zone?: string
          type: string
        }
        Update: {
          amount?: number | null
          archived?: boolean
          attorney_id?: string | null
          booked_by_id?: string | null
          case_type?: string | null
          duration_min?: number
          firm_id?: string
          id?: string
          lead_id?: string | null
          lead_name?: string
          paid?: boolean
          start_at?: string
          status?: Database["public"]["Enums"]["consultation_status"]
          time_zone?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_booked_by_id_fkey"
            columns: ["booked_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      deadlines: {
        Row: {
          attorney_id: string | null
          case_id: string
          client_name: string
          due_at: string
          firm_id: string
          id: string
          kind: string
          la_id: string | null
          status: Database["public"]["Enums"]["deadline_status"]
        }
        Insert: {
          attorney_id?: string | null
          case_id: string
          client_name: string
          due_at: string
          firm_id?: string
          id?: string
          kind: string
          la_id?: string | null
          status?: Database["public"]["Enums"]["deadline_status"]
        }
        Update: {
          attorney_id?: string | null
          case_id?: string
          client_name?: string
          due_at?: string
          firm_id?: string
          id?: string
          kind?: string
          la_id?: string | null
          status?: Database["public"]["Enums"]["deadline_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "immigration_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_la_id_fkey"
            columns: ["la_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived: boolean
          case_id: string | null
          case_type: string | null
          category: string
          client_id: string | null
          client_name: string
          doc_type: string
          firm_id: string
          id: string
          name: string
          status: Database["public"]["Enums"]["doc_status"]
          uploaded_at: string
          uploaded_by_id: string | null
        }
        Insert: {
          archived?: boolean
          case_id?: string | null
          case_type?: string | null
          category: string
          client_id?: string | null
          client_name: string
          doc_type: string
          firm_id?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["doc_status"]
          uploaded_at?: string
          uploaded_by_id?: string | null
        }
        Update: {
          archived?: boolean
          case_id?: string | null
          case_type?: string | null
          category?: string
          client_id?: string | null
          client_name?: string
          doc_type?: string
          firm_id?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["doc_status"]
          uploaded_at?: string
          uploaded_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "immigration_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_taxonomies: {
        Row: {
          category: string
          created_at: string
          firm_id: string
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          notes: string | null
          position: number
        }
        Insert: {
          category: string
          created_at?: string
          firm_id?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          notes?: string | null
          position?: number
        }
        Update: {
          category?: string
          created_at?: string
          firm_id?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          notes?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "firm_taxonomies_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      immigration_cases: {
        Row: {
          archived: boolean
          attorney_id: string | null
          case_type: string
          checklist_complete: number
          client_id: string
          client_name: string
          date_hired: string
          difficulty: number
          expected_mailing: string | null
          firm_id: string
          hierarchy: string
          id: string
          la_id: string | null
          open_deadlines: number
          red_flag: Database["public"]["Enums"]["red_flag"]
          stage: number
          status: Database["public"]["Enums"]["case_status"]
        }
        Insert: {
          archived?: boolean
          attorney_id?: string | null
          case_type: string
          checklist_complete?: number
          client_id: string
          client_name: string
          date_hired?: string
          difficulty?: number
          expected_mailing?: string | null
          firm_id?: string
          hierarchy?: string
          id?: string
          la_id?: string | null
          open_deadlines?: number
          red_flag?: Database["public"]["Enums"]["red_flag"]
          stage?: number
          status?: Database["public"]["Enums"]["case_status"]
        }
        Update: {
          archived?: boolean
          attorney_id?: string | null
          case_type?: string
          checklist_complete?: number
          client_id?: string
          client_name?: string
          date_hired?: string
          difficulty?: number
          expected_mailing?: string | null
          firm_id?: string
          hierarchy?: string
          id?: string
          la_id?: string | null
          open_deadlines?: number
          red_flag?: Database["public"]["Enums"]["red_flag"]
          stage?: number
          status?: Database["public"]["Enums"]["case_status"]
        }
        Relationships: [
          {
            foreignKeyName: "immigration_cases_attorney_id_fkey"
            columns: ["attorney_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "immigration_cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "immigration_cases_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "immigration_cases_la_id_fkey"
            columns: ["la_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          at: string
          by_id: string | null
          firm_id: string
          id: string
          lead_id: string
          summary: string
          type: string
        }
        Insert: {
          at?: string
          by_id?: string | null
          firm_id?: string
          id?: string
          lead_id: string
          summary: string
          type: string
        }
        Update: {
          at?: string
          by_id?: string | null
          firm_id?: string
          id?: string
          lead_id?: string
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_by_id_fkey"
            columns: ["by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          archived: boolean
          case_type: string | null
          client_id: string | null
          client_name: string
          created_at: string
          due_at: string | null
          firm_id: string
          id: string
          months_behind: number | null
          number: string
          paid: number
          remaining: number
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          archived?: boolean
          case_type?: string | null
          client_id?: string | null
          client_name: string
          created_at?: string
          due_at?: string | null
          firm_id?: string
          id?: string
          months_behind?: number | null
          number: string
          paid?: number
          remaining?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          archived?: boolean
          case_type?: string | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          due_at?: string | null
          firm_id?: string
          id?: string
          months_behind?: number | null
          number?: string
          paid?: number
          remaining?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string
          default_assignee_id: string | null
          enabled: boolean
          firm_id: string
          id: string
          key: string
          key_hash: string
          key_last4: string
          kind: string
          name: string
        }
        Insert: {
          created_at?: string
          default_assignee_id?: string | null
          enabled?: boolean
          firm_id?: string
          id?: string
          key: string
          key_hash: string
          key_last4: string
          kind?: string
          name: string
        }
        Update: {
          created_at?: string
          default_assignee_id?: string | null
          enabled?: boolean
          firm_id?: string
          id?: string
          key?: string
          key_hash?: string
          key_last4?: string
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_assignee_firm_fk"
            columns: ["default_assignee_id", "firm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "firm_id"]
          },
          {
            foreignKeyName: "lead_sources_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_statuses: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          is_system: boolean
          is_terminal: boolean
          key: string
          name: string
          position: number
          tone: string
        }
        Insert: {
          created_at?: string
          firm_id?: string
          id?: string
          is_system?: boolean
          is_terminal?: boolean
          key: string
          name: string
          position?: number
          tone?: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          is_system?: boolean
          is_terminal?: boolean
          key?: string
          name?: string
          position?: number
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_statuses_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived: boolean
          assigned_to_id: string | null
          created_at: string
          data: Json
          email: string
          external_id: string | null
          firm_id: string
          first_name: string
          id: string
          last_activity: string
          last_name: string
          phone: string
          source: string
          status_id: string
        }
        Insert: {
          archived?: boolean
          assigned_to_id?: string | null
          created_at?: string
          data?: Json
          email?: string
          external_id?: string | null
          firm_id?: string
          first_name: string
          id?: string
          last_activity?: string
          last_name: string
          phone?: string
          source: string
          status_id: string
        }
        Update: {
          archived?: boolean
          assigned_to_id?: string | null
          created_at?: string
          data?: Json
          email?: string
          external_id?: string | null
          firm_id?: string
          first_name?: string
          id?: string
          last_activity?: string
          last_name?: string
          phone?: string
          source?: string
          status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_firm_fk"
            columns: ["status_id", "firm_id"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["id", "firm_id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          created_by_id: string | null
          edited_at: string | null
          entity_id: string
          entity_type: string
          firm_id: string
          hidden_at: string | null
          hidden_by_id: string | null
          id: string
          kind: string
          resolved_at: string | null
          resolved_by_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by_id?: string | null
          edited_at?: string | null
          entity_id: string
          entity_type: string
          firm_id?: string
          hidden_at?: string | null
          hidden_by_id?: string | null
          id?: string
          kind?: string
          resolved_at?: string | null
          resolved_by_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by_id?: string | null
          edited_at?: string | null
          entity_id?: string
          entity_type?: string
          firm_id?: string
          hidden_at?: string | null
          hidden_by_id?: string | null
          id?: string
          kind?: string
          resolved_at?: string | null
          resolved_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_hidden_by_id_fkey"
            columns: ["hidden_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_resolved_by_id_fkey"
            columns: ["resolved_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      packet_stages: {
        Row: {
          firm_id: string
          id: string
          name: string
          position: number
          sla_days: number
        }
        Insert: {
          firm_id?: string
          id?: string
          name: string
          position?: number
          sla_days?: number
        }
        Update: {
          firm_id?: string
          id?: string
          name?: string
          position?: number
          sla_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "packet_stages_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      pods: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          lead_user_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          firm_id?: string
          id?: string
          lead_user_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          lead_user_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pods_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pods_lead_user_id_fkey"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          firm_id: string
          id: string
          initials: string
          name: string
          pod_id: string | null
          role: Database["public"]["Enums"]["staff_role"]
          status: Database["public"]["Enums"]["staff_status"]
        }
        Insert: {
          created_at?: string
          email: string
          firm_id: string
          id: string
          initials?: string
          name: string
          pod_id?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
        }
        Update: {
          created_at?: string
          email?: string
          firm_id?: string
          id?: string
          initials?: string
          name?: string
          pod_id?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          status?: Database["public"]["Enums"]["staff_status"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Insert: {
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Update: {
          permission?: Database["public"]["Enums"]["app_permission"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          is_system: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          firm_id?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          firm_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          firm_id?: string
          role_id: string
          user_id: string
        }
        Update: {
          firm_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_firm_id_fkey"
            columns: ["role_id", "firm_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id", "firm_id"]
          },
          {
            foreignKeyName: "user_roles_user_id_firm_id_fkey"
            columns: ["user_id", "firm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "firm_id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error: string | null
          external_id: string | null
          firm_id: string
          id: string
          lead_id: string | null
          raw_payload: Json
          received_at: string
          source_id: string
          status: string
        }
        Insert: {
          error?: string | null
          external_id?: string | null
          firm_id: string
          id?: string
          lead_id?: string | null
          raw_payload?: Json
          received_at?: string
          source_id: string
          status: string
        }
        Update: {
          error?: string | null
          external_id?: string | null
          firm_id?: string
          id?: string
          lead_id?: string | null
          raw_payload?: Json
          received_at?: string
          source_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_source_firm_fk"
            columns: ["source_id", "firm_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id", "firm_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authorize: {
        Args: {
          requested_permission: Database["public"]["Enums"]["app_permission"]
        }
        Returns: boolean
      }
      current_firm_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      firm_exists: { Args: { p_firm_id: string }; Returns: boolean }
      firm_has_active_settings_manager: {
        Args: { p_firm_id: string }
        Returns: boolean
      }
      firm_taxonomy_in_use: {
        Args: { p_category: string; p_firm: string; p_label: string }
        Returns: boolean
      }
      invite_token_for: { Args: { p_user_id: string }; Returns: string }
      rename_firm_taxonomy: {
        Args: { p_id: string; p_label: string; p_notes: string }
        Returns: undefined
      }
      seed_firm_taxonomies: { Args: { p_firm_id: string }; Returns: undefined }
      seed_lead_statuses: { Args: { p_firm_id: string }; Returns: undefined }
      seed_system_roles: { Args: { p_firm_id: string }; Returns: undefined }
      set_role_permissions: {
        Args: {
          p_permissions: Database["public"]["Enums"]["app_permission"][]
          p_role_id: string
        }
        Returns: undefined
      }
      set_user_roles: {
        Args: { p_role_ids: string[]; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_permission:
        | "dashboard.view"
        | "leads.view"
        | "leads.edit"
        | "consultations.view"
        | "consultations.edit"
        | "clients.view"
        | "clients.edit"
        | "cases.view"
        | "cases.edit"
        | "documents.view"
        | "documents.edit"
        | "billing.view"
        | "billing.view_status"
        | "billing.edit"
        | "reporting.view"
        | "reporting.edit"
        | "users.manage"
        | "settings.manage"
      audit_entity:
        | "lead"
        | "consultation"
        | "client"
        | "case"
        | "invoice"
        | "document"
        | "user"
        | "role"
        | "lead_source"
        | "taxonomy"
      case_status:
        | "onboarding"
        | "packet_prep"
        | "in_review"
        | "filed"
        | "rfe"
        | "approved"
      client_status:
        | "active"
        | "monthly_plan"
        | "on_hold"
        | "completed"
        | "terminated"
      consultation_status:
        | "scheduled"
        | "paid"
        | "completed"
        | "rescheduled"
        | "canceled"
        | "no_show"
      deadline_status: "open" | "responded" | "overdue"
      doc_status: "pending" | "submitted" | "verified"
      invoice_status: "draft" | "sent" | "partial" | "paid" | "overdue" | "void"
      payment_status: "current" | "overdue" | "paid" | "payment_arrangement"
      payment_type:
        | "down_payment"
        | "monthly"
        | "full_payment"
        | "partial_down"
        | "consultation"
        | "filing_fee"
      red_flag: "none" | "red_flag_client" | "red_flag_packet"
      staff_role:
        | "admin"
        | "attorney"
        | "la_lead"
        | "legal_assistant"
        | "qa_lead"
        | "creative_writer"
        | "sales"
        | "accounts_receivable"
        | "file_clerk"
      staff_status: "active" | "invited" | "disabled"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_status: "not_started" | "in_progress" | "completed"
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
  public: {
    Enums: {
      app_permission: [
        "dashboard.view",
        "leads.view",
        "leads.edit",
        "consultations.view",
        "consultations.edit",
        "clients.view",
        "clients.edit",
        "cases.view",
        "cases.edit",
        "documents.view",
        "documents.edit",
        "billing.view",
        "billing.view_status",
        "billing.edit",
        "reporting.view",
        "reporting.edit",
        "users.manage",
        "settings.manage",
      ],
      audit_entity: [
        "lead",
        "consultation",
        "client",
        "case",
        "invoice",
        "document",
        "user",
        "role",
        "lead_source",
        "taxonomy",
      ],
      case_status: [
        "onboarding",
        "packet_prep",
        "in_review",
        "filed",
        "rfe",
        "approved",
      ],
      client_status: [
        "active",
        "monthly_plan",
        "on_hold",
        "completed",
        "terminated",
      ],
      consultation_status: [
        "scheduled",
        "paid",
        "completed",
        "rescheduled",
        "canceled",
        "no_show",
      ],
      deadline_status: ["open", "responded", "overdue"],
      doc_status: ["pending", "submitted", "verified"],
      invoice_status: ["draft", "sent", "partial", "paid", "overdue", "void"],
      payment_status: ["current", "overdue", "paid", "payment_arrangement"],
      payment_type: [
        "down_payment",
        "monthly",
        "full_payment",
        "partial_down",
        "consultation",
        "filing_fee",
      ],
      red_flag: ["none", "red_flag_client", "red_flag_packet"],
      staff_role: [
        "admin",
        "attorney",
        "la_lead",
        "legal_assistant",
        "qa_lead",
        "creative_writer",
        "sales",
        "accounts_receivable",
        "file_clerk",
      ],
      staff_status: ["active", "invited", "disabled"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_status: ["not_started", "in_progress", "completed"],
    },
  },
} as const

