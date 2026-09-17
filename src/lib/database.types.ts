export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activity_posts: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          event_id: string
          heading: string
          id: string
          kind: Database["public"]["Enums"]["post_kind"]
          ref_checkin_id: string | null
          ref_submission_id: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string
          created_at?: string
          event_id: string
          heading: string
          id?: string
          kind: Database["public"]["Enums"]["post_kind"]
          ref_checkin_id?: string | null
          ref_submission_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          event_id?: string
          heading?: string
          id?: string
          kind?: Database["public"]["Enums"]["post_kind"]
          ref_checkin_id?: string | null
          ref_submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "activity_posts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_posts_ref_checkin_id_fkey"
            columns: ["ref_checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_posts_ref_submission_id_fkey"
            columns: ["ref_submission_id"]
            isOneToOne: false
            referencedRelation: "challenge_scores"
            referencedColumns: ["approved_submission_id"]
          },
          {
            foreignKeyName: "activity_posts_ref_submission_id_fkey"
            columns: ["ref_submission_id"]
            isOneToOne: false
            referencedRelation: "evidence_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_cards: {
        Row: {
          created_at: string
          event_id: string
          id: string
          layout: number[]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          layout: number[]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          layout?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_cards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "bingo_cards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_incidents: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          event_id: string
          id: string
          note: string | null
          proposed_by: string | null
          square_id: string
          status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          event_id: string
          id?: string
          note?: string | null
          proposed_by?: string | null
          square_id: string
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          event_id?: string
          id?: string
          note?: string | null
          proposed_by?: string | null
          square_id?: string
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bingo_incidents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "bingo_incidents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingo_incidents_square_id_fkey"
            columns: ["square_id"]
            isOneToOne: false
            referencedRelation: "bingo_squares"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_squares: {
        Row: {
          event_id: string
          id: string
          is_free: boolean
          position: number
          text: string
        }
        Insert: {
          event_id: string
          id?: string
          is_free?: boolean
          position: number
          text: string
        }
        Update: {
          event_id?: string
          id?: string
          is_free?: boolean
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_squares_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "bingo_squares_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      bingo_wins: {
        Row: {
          achieved_at: string
          event_id: string
          id: string
          incident_id: string | null
          line_key: string
          user_id: string
        }
        Insert: {
          achieved_at?: string
          event_id: string
          id?: string
          incident_id?: string | null
          line_key: string
          user_id: string
        }
        Update: {
          achieved_at?: string
          event_id?: string
          id?: string
          incident_id?: string | null
          line_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bingo_wins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "bingo_wins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bingo_wins_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "bingo_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          event_id: string
          is_public: boolean
          issued_at: string | null
          issued_by: string | null
          participant_consent: boolean
          status: Database["public"]["Enums"]["certificate_status"]
          summary: Json
          updated_at: string
        }
        Insert: {
          event_id: string
          is_public?: boolean
          issued_at?: string | null
          issued_by?: string | null
          participant_consent?: boolean
          status?: Database["public"]["Enums"]["certificate_status"]
          summary?: Json
          updated_at?: string
        }
        Update: {
          event_id?: string
          is_public?: boolean
          issued_at?: string | null
          issued_by?: string | null
          participant_consent?: boolean
          status?: Database["public"]["Enums"]["certificate_status"]
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "certificates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          event_id: string
          id: string
          points: number
          proof_type: string
          sequence: number
          title: string
        }
        Insert: {
          event_id: string
          id?: string
          points: number
          proof_type: string
          sequence: number
          title: string
        }
        Update: {
          event_id?: string
          id?: string
          points?: number
          proof_type?: string
          sequence?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "challenges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          accuracy_m: number | null
          captured_at: string
          client_id: string
          event_id: string
          id: string
          latitude: number
          longitude: number
          received_at: string
          removed_at: string | null
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          captured_at: string
          client_id: string
          event_id: string
          id?: string
          latitude: number
          longitude: number
          received_at?: string
          removed_at?: string | null
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          captured_at?: string
          client_id?: string
          event_id?: string
          id?: string
          latitude?: number
          longitude?: number
          received_at?: string
          removed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          away_arrival_at: string
          away_town: string
          carrier: string | null
          created_at: string
          departure_at: string
          home_arrival_at: string
          home_town: string
          id: string
          league_id: string
          max_points: number
          name: string
          participant_user_id: string | null
          prediction_lock_at: string
          prediction_reveal_at: string
          required_run_km: number
          return_departure_at: string
          season_punished: number | null
          slug: string
          stated_programme_distance_km: number | null
          subtitle: string | null
          timezone: string
        }
        Insert: {
          away_arrival_at: string
          away_town: string
          carrier?: string | null
          created_at?: string
          departure_at: string
          home_arrival_at: string
          home_town: string
          id?: string
          league_id: string
          max_points?: number
          name: string
          participant_user_id?: string | null
          prediction_lock_at: string
          prediction_reveal_at: string
          required_run_km?: number
          return_departure_at: string
          season_punished?: number | null
          slug: string
          stated_programme_distance_km?: number | null
          subtitle?: string | null
          timezone?: string
        }
        Update: {
          away_arrival_at?: string
          away_town?: string
          carrier?: string | null
          created_at?: string
          departure_at?: string
          home_arrival_at?: string
          home_town?: string
          id?: string
          league_id?: string
          max_points?: number
          name?: string
          participant_user_id?: string | null
          prediction_lock_at?: string
          prediction_reveal_at?: string
          required_run_km?: number
          return_departure_at?: string
          season_punished?: number | null
          slug?: string
          stated_programme_distance_km?: number | null
          subtitle?: string | null
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_files: {
        Row: {
          byte_size: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          mime_type: string
          original_name: string | null
          storage_path: string
          submission_id: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          mime_type: string
          original_name?: string | null
          storage_path: string
          submission_id: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["evidence_kind"]
          mime_type?: string
          original_name?: string | null
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "challenge_scores"
            referencedColumns: ["approved_submission_id"]
          },
          {
            foreignKeyName: "evidence_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "evidence_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_submissions: {
        Row: {
          caption: string
          challenge_id: string | null
          created_at: string
          event_id: string
          id: string
          press_prompt_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          submitter_id: string
          updated_at: string
          version: number
        }
        Insert: {
          caption?: string
          challenge_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          press_prompt_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitter_id: string
          updated_at?: string
          version: number
        }
        Update: {
          caption?: string
          challenge_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          press_prompt_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          submitter_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidence_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenge_scores"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "evidence_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "evidence_submissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_submissions_press_prompt_id_fkey"
            columns: ["press_prompt_id"]
            isOneToOne: false
            referencedRelation: "press_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          description: string | null
          event_id: string
          id: string
          latitude: number | null
          location_verified: boolean
          longitude: number | null
          quarter: number
          sequence: number
          starts_at: string
          title: string
          venue_text: string | null
        }
        Insert: {
          description?: string | null
          event_id: string
          id?: string
          latitude?: number | null
          location_verified?: boolean
          longitude?: number | null
          quarter: number
          sequence: number
          starts_at: string
          title: string
          venue_text?: string | null
        }
        Update: {
          description?: string | null
          event_id?: string
          id?: string
          latitude?: number | null
          location_verified?: boolean
          longitude?: number | null
          quarter?: number
          sequence?: number
          starts_at?: string
          title?: string
          venue_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "itinerary_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          name: string
          sleeper_league_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sleeper_league_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sleeper_league_id?: string | null
          slug?: string
        }
        Relationships: []
      }
      location_settings: {
        Row: {
          auto_update: boolean
          event_id: string
          sharing_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_update?: boolean
          event_id: string
          sharing_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_update?: boolean
          event_id?: string
          sharing_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "location_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          is_admin: boolean
          is_commissioner: boolean
          league_id: string
          role: Database["public"]["Enums"]["membership_role"]
          sleeper_confirmed: boolean
          sleeper_user_id: string | null
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          is_admin?: boolean
          is_commissioner?: boolean
          league_id: string
          role?: Database["public"]["Enums"]["membership_role"]
          sleeper_confirmed?: boolean
          sleeper_user_id?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          is_admin?: boolean
          is_commissioner?: boolean
          league_id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          sleeper_confirmed?: boolean
          sleeper_user_id?: string | null
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      official_results: {
        Row: {
          complaint_count: number | null
          event_id: string
          meal_rating: number | null
          resolved_at: string | null
          run_distance_km: number | null
          run_seconds: number | null
          set_at: string
          set_by: string | null
        }
        Insert: {
          complaint_count?: number | null
          event_id: string
          meal_rating?: number | null
          resolved_at?: string | null
          run_distance_km?: number | null
          run_seconds?: number | null
          set_at?: string
          set_by?: string | null
        }
        Update: {
          complaint_count?: number | null
          event_id?: string
          meal_rating?: number | null
          resolved_at?: string | null
          run_distance_km?: number | null
          run_seconds?: number | null
          set_at?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "official_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "official_results_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      penalties: {
        Row: {
          applied: boolean
          applied_at: string | null
          applied_by: string | null
          event_id: string
          id: string
          note: string | null
          sequence: number
          text: string
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          applied_by?: string | null
          event_id: string
          id?: string
          note?: string | null
          sequence: number
          text: string
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          applied_by?: string | null
          event_id?: string
          id?: string
          note?: string | null
          sequence?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "penalties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "penalties_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_awards: {
        Row: {
          awarded_at: string
          category: string
          event_id: string
          points: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          category: string
          event_id: string
          points: number
          user_id: string
        }
        Update: {
          awarded_at?: string
          category?: string
          event_id?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_awards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "prediction_awards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_rules: {
        Row: {
          complaints_points: number
          event_id: string
          meal_points: number
          run_points: number
          updated_at: string
        }
        Insert: {
          complaints_points?: number
          event_id: string
          meal_points?: number
          run_points?: number
          updated_at?: string
        }
        Update: {
          complaints_points?: number
          event_id?: string
          meal_points?: number
          run_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "prediction_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          complaint_count: number
          created_at: string
          event_id: string
          meal_rating: number
          run_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          complaint_count: number
          created_at?: string
          event_id: string
          meal_rating: number
          run_seconds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          complaint_count?: number
          created_at?: string
          event_id?: string
          meal_rating?: number
          run_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "predictions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      press_prompts: {
        Row: {
          closes_at: string | null
          event_id: string
          id: string
          opens_at: string
          question: string
          sequence: number
          slot: Database["public"]["Enums"]["press_slot"]
        }
        Insert: {
          closes_at?: string | null
          event_id: string
          id?: string
          opens_at: string
          question: string
          sequence: number
          slot: Database["public"]["Enums"]["press_slot"]
        }
        Update: {
          closes_at?: string | null
          event_id?: string
          id?: string
          opens_at?: string
          question?: string
          sequence?: number
          slot?: Database["public"]["Enums"]["press_slot"]
        }
        Relationships: [
          {
            foreignKeyName: "press_prompts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "press_prompts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          kit_number: number
          kit_team: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          kit_number?: number
          kit_team?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          kit_number?: number
          kit_team?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "activity_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      review_decisions: {
        Row: {
          actor_id: string
          created_at: string
          decision: Database["public"]["Enums"]["review_decision_kind"]
          id: string
          idempotency_key: string
          note: string | null
          reason: string | null
          submission_id: string
          submission_version: number
        }
        Insert: {
          actor_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["review_decision_kind"]
          id?: string
          idempotency_key: string
          note?: string | null
          reason?: string | null
          submission_id: string
          submission_version: number
        }
        Update: {
          actor_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["review_decision_kind"]
          id?: string
          idempotency_key?: string
          note?: string | null
          reason?: string | null
          submission_id?: string
          submission_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_decisions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "challenge_scores"
            referencedColumns: ["approved_submission_id"]
          },
          {
            foreignKeyName: "review_decisions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "evidence_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      sleeper_league_users: {
        Row: {
          avatar: string | null
          display_name: string
          imported_at: string
          is_owner: boolean
          league_id: string
          season: string | null
          sleeper_user_id: string
          team_name: string | null
          username: string | null
        }
        Insert: {
          avatar?: string | null
          display_name: string
          imported_at?: string
          is_owner?: boolean
          league_id: string
          season?: string | null
          sleeper_user_id: string
          team_name?: string | null
          username?: string | null
        }
        Update: {
          avatar?: string | null
          display_name?: string
          imported_at?: string
          is_owner?: boolean
          league_id?: string
          season?: string | null
          sleeper_user_id?: string
          team_name?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sleeper_league_users_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      challenge_scores: {
        Row: {
          approved_submission_id: string | null
          approved_version: number | null
          awarded_points: number | null
          challenge_id: string | null
          event_id: string | null
          points: number | null
          proof_type: string | null
          sequence: number | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "challenges_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_scores: {
        Row: {
          approved_challenges: number | null
          approved_points: number | null
          event_id: string | null
          max_points: number | null
          total_challenges: number | null
        }
        Relationships: []
      }
      predictions_revealed: {
        Row: {
          complaint_count: number | null
          created_at: string | null
          display_name: string | null
          event_id: string | null
          kit_team: string | null
          meal_rating: number | null
          run_seconds: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_scores"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "predictions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_membership: { Args: never; Returns: undefined }
      bingo_leaderboard: {
        Args: { p_event: string }
        Returns: {
          display_name: string
          first_line_at: string
          full_house_at: string
          kit_team: string
          lines: number
          marked: number
          user_id: string
        }[]
      }
      bingo_lines: {
        Args: { p_marked_cells: number[] }
        Returns: {
          line_key: string
        }[]
      }
      claim_kit: {
        Args: { p_number: number; p_team: string }
        Returns: {
          created_at: string
          display_name: string
          id: string
          kit_number: number
          kit_team: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_sleeper_identity: {
        Args: { p_league: string; p_sleeper_user_id?: string }
        Returns: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          is_admin: boolean
          is_commissioner: boolean
          league_id: string
          role: Database["public"]["Enums"]["membership_role"]
          sleeper_confirmed: boolean
          sleeper_user_id: string | null
          status: Database["public"]["Enums"]["membership_status"]
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
      claimed_kits: {
        Args: never
        Returns: {
          display_name: string
          kit_team: string
          user_id: string
        }[]
      }
      confirm_sleeper_link: {
        Args: {
          p_confirmed: boolean
          p_league: string
          p_sleeper_user_id?: string
          p_user: string
        }
        Returns: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          is_admin: boolean
          is_commissioner: boolean
          league_id: string
          role: Database["public"]["Enums"]["membership_role"]
          sleeper_confirmed: boolean
          sleeper_user_id: string | null
          status: Database["public"]["Enums"]["membership_status"]
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
      create_submission: {
        Args: {
          p_caption?: string
          p_challenge?: string
          p_event: string
          p_press_prompt?: string
        }
        Returns: {
          caption: string
          challenge_id: string | null
          created_at: string
          event_id: string
          id: string
          press_prompt_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          submitter_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "evidence_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_bingo_incident: {
        Args: { p_confirm: boolean; p_incident: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          event_id: string
          id: string
          note: string | null
          proposed_by: string | null
          square_id: string
          status: Database["public"]["Enums"]["incident_status"]
        }
        SetofOptions: {
          from: "*"
          to: "bingo_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_bingo_card: {
        Args: { p_event: string }
        Returns: {
          created_at: string
          event_id: string
          id: string
          layout: number[]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bingo_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      league_context: {
        Args: { p_event_slug: string; p_league_slug: string }
        Returns: Json
      }
      issue_certificate: {
        Args: { p_event: string; p_is_public: boolean }
        Returns: {
          event_id: string
          is_public: boolean
          issued_at: string | null
          issued_by: string | null
          participant_consent: boolean
          status: Database["public"]["Enums"]["certificate_status"]
          summary: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_event_role: { Args: { p_event: string }; Returns: string }
      pb_event_league: { Args: { p_event: string }; Returns: string }
      pb_is_admin: { Args: { p_league: string }; Returns: boolean }
      pb_is_commissioner: { Args: { p_league: string }; Returns: boolean }
      pb_is_event_admin: { Args: { p_event: string }; Returns: boolean }
      pb_is_event_commissioner: { Args: { p_event: string }; Returns: boolean }
      pb_is_event_member: { Args: { p_event: string }; Returns: boolean }
      pb_is_event_participant: { Args: { p_event: string }; Returns: boolean }
      pb_is_member: { Args: { p_league: string }; Returns: boolean }
      pb_shares_league: { Args: { p_user: string }; Returns: boolean }
      propose_bingo_incident: {
        Args: { p_event: string; p_note?: string; p_square: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          event_id: string
          id: string
          note: string | null
          proposed_by: string | null
          square_id: string
          status: Database["public"]["Enums"]["incident_status"]
        }
        SetofOptions: {
          from: "*"
          to: "bingo_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      public_certificate: {
        Args: { p_event_slug: string; p_league_slug: string }
        Returns: Json
      }
      record_checkin: {
        Args: {
          p_accuracy_m?: number
          p_captured_at: string
          p_client_id: string
          p_event: string
          p_latitude: number
          p_longitude: number
        }
        Returns: {
          accuracy_m: number | null
          captured_at: string
          client_id: string
          event_id: string
          id: string
          latitude: number
          longitude: number
          received_at: string
          removed_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "checkins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_checkins: {
        Args: { p_event: string; p_ids?: string[] }
        Returns: number
      }
      resolve_predictions: { Args: { p_event: string }; Returns: number }
      review_submission: {
        Args: {
          p_decision: Database["public"]["Enums"]["review_decision_kind"]
          p_idempotency_key: string
          p_note?: string
          p_reason?: string
          p_submission: string
          p_version: number
        }
        Returns: {
          actor_id: string
          created_at: string
          decision: Database["public"]["Enums"]["review_decision_kind"]
          id: string
          idempotency_key: string
          note: string | null
          reason: string | null
          submission_id: string
          submission_version: number
        }
        SetofOptions: {
          from: "*"
          to: "review_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_certificate_consent: {
        Args: { p_consent: boolean; p_event: string }
        Returns: {
          event_id: string
          is_public: boolean
          issued_at: string | null
          issued_by: string | null
          participant_consent: boolean
          status: Database["public"]["Enums"]["certificate_status"]
          summary: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_event_participant: {
        Args: { p_event: string; p_user?: string }
        Returns: {
          away_arrival_at: string
          away_town: string
          carrier: string | null
          created_at: string
          departure_at: string
          home_arrival_at: string
          home_town: string
          id: string
          league_id: string
          max_points: number
          name: string
          participant_user_id: string | null
          prediction_lock_at: string
          prediction_reveal_at: string
          required_run_km: number
          return_departure_at: string
          season_punished: number | null
          slug: string
          stated_programme_distance_km: number | null
          subtitle: string | null
          timezone: string
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_member_role: {
        Args: {
          p_is_admin?: boolean
          p_is_commissioner: boolean
          p_league: string
          p_role: Database["public"]["Enums"]["membership_role"]
          p_status: Database["public"]["Enums"]["membership_status"]
          p_user: string
        }
        Returns: {
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          is_admin: boolean
          is_commissioner: boolean
          league_id: string
          role: Database["public"]["Enums"]["membership_role"]
          sleeper_confirmed: boolean
          sleeper_user_id: string | null
          status: Database["public"]["Enums"]["membership_status"]
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
      set_penalty: {
        Args: { p_applied: boolean; p_note?: string; p_penalty: string }
        Returns: {
          applied: boolean
          applied_at: string | null
          applied_by: string | null
          event_id: string
          id: string
          note: string | null
          sequence: number
          text: string
        }
        SetofOptions: {
          from: "*"
          to: "penalties"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_submission: {
        Args: { p_submission: string }
        Returns: {
          caption: string
          challenge_id: string | null
          created_at: string
          event_id: string
          id: string
          press_prompt_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          submitter_id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "evidence_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_prediction: {
        Args: {
          p_complaint_count: number
          p_event: string
          p_meal_rating: number
          p_run_seconds: number
        }
        Returns: {
          complaint_count: number
          created_at: string
          event_id: string
          meal_rating: number
          run_seconds: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "predictions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      certificate_status: "pending" | "issued"
      evidence_kind: "photo" | "video" | "audio" | "document" | "gps"
      incident_status: "proposed" | "confirmed" | "rejected"
      membership_role: "participant" | "member"
      membership_status: "invited" | "active" | "removed"
      post_kind:
        | "checkin"
        | "comment"
        | "submission"
        | "decision"
        | "bingo"
        | "prediction"
        | "system"
      press_slot: "midday" | "sunset"
      review_decision_kind: "approved" | "flagged" | "superseded"
      submission_status:
        | "draft"
        | "submitted"
        | "approved"
        | "flagged"
        | "superseded"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      certificate_status: ["pending", "issued"],
      evidence_kind: ["photo", "video", "audio", "document", "gps"],
      incident_status: ["proposed", "confirmed", "rejected"],
      membership_role: ["participant", "member"],
      membership_status: ["invited", "active", "removed"],
      post_kind: [
        "checkin",
        "comment",
        "submission",
        "decision",
        "bingo",
        "prediction",
        "system",
      ],
      press_slot: ["midday", "sunset"],
      review_decision_kind: ["approved", "flagged", "superseded"],
      submission_status: [
        "draft",
        "submitted",
        "approved",
        "flagged",
        "superseded",
      ],
    },
  },
} as const

