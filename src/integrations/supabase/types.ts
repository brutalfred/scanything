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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_visits: {
        Row: {
          created_at: string
          id: string
          user_id: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          visit_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          visit_date?: string
        }
        Relationships: []
      }
      ad_reward_claims: {
        Row: {
          created_at: string
          credits: number
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          action: string
          cost_micro_usd: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          action: string
          cost_micro_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          user_id?: string | null
        }
        Update: {
          action?: string
          cost_micro_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      checkin_streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_checkin_date: string | null
          longest_streak: number
          total_rewards: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_checkin_date?: string | null
          longest_streak?: number
          total_rewards?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_checkin_date?: string | null
          longest_streak?: number
          total_rewards?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_accounts: {
        Row: {
          balance: number
          created_at: string
          last_daily_grant_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          last_daily_grant_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          last_daily_grant_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          metadata?: Json
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_cents: number | null
          created_at: string
          credits: number
          currency: string | null
          environment: string
          id: string
          paddle_transaction_id: string
          price_id: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          credits: number
          currency?: string | null
          environment?: string
          id?: string
          paddle_transaction_id: string
          price_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          credits?: number
          currency?: string | null
          environment?: string
          id?: string
          paddle_transaction_id?: string
          price_id?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transfers: {
        Row: {
          amount: number
          created_at: string
          id: string
          recipient_email: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          recipient_email: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          recipient_email?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      daily_free_scans: {
        Row: {
          created_at: string
          id: string
          scan_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scan_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scan_date?: string
          user_id?: string
        }
        Relationships: []
      }
      device_grants: {
        Row: {
          created_at: string
          device_hash: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      game_prize_payouts: {
        Row: {
          created_at: string
          credits: number
          id: string
          month_key: string
          place: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          month_key: string
          place: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          month_key?: string
          place?: number
          user_id?: string
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          created_at: string
          display_name: string
          id: string
          month_key: string
          time_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          month_key: string
          time_ms: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          month_key?: string
          time_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      play_purchases: {
        Row: {
          created_at: string
          credits: number
          id: string
          order_id: string | null
          product_id: string
          purchase_token: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          id?: string
          order_id?: string | null
          product_id: string
          purchase_token: string
          state?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          order_id?: string | null
          product_id?: string
          purchase_token?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      play_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          order_id: string | null
          plan: string
          product_id: string
          purchase_token: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          order_id?: string | null
          plan: string
          product_id: string
          purchase_token: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          order_id?: string | null
          plan?: string
          product_id?: string
          purchase_token?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      poker_chips: {
        Row: {
          chips: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chips?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chips?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poker_hands: {
        Row: {
          acting_seat: number | null
          action_deadline: string | null
          board: Json
          created_at: string
          current_bet: number
          dealer_seat: number
          deck: Json
          hand_no: number
          hole_cards: Json
          id: string
          min_raise: number
          pot: number
          result_text: string | null
          stage: string
          status: string
          table_id: string
          updated_at: string
          winners: Json
        }
        Insert: {
          acting_seat?: number | null
          action_deadline?: string | null
          board?: Json
          created_at?: string
          current_bet?: number
          dealer_seat?: number
          deck?: Json
          hand_no?: number
          hole_cards?: Json
          id?: string
          min_raise?: number
          pot?: number
          result_text?: string | null
          stage?: string
          status?: string
          table_id: string
          updated_at?: string
          winners?: Json
        }
        Update: {
          acting_seat?: number | null
          action_deadline?: string | null
          board?: Json
          created_at?: string
          current_bet?: number
          dealer_seat?: number
          deck?: Json
          hand_no?: number
          hole_cards?: Json
          id?: string
          min_raise?: number
          pot?: number
          result_text?: string | null
          stage?: string
          status?: string
          table_id?: string
          updated_at?: string
          winners?: Json
        }
        Relationships: [
          {
            foreignKeyName: "poker_hands_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_seats: {
        Row: {
          all_in: boolean
          created_at: string
          current_bet: number
          display_name: string
          folded: boolean
          has_acted: boolean
          id: string
          in_hand: boolean
          is_bot: boolean
          last_action: string | null
          seat_index: number
          shown_cards: Json | null
          stack: number
          table_id: string
          total_committed: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          all_in?: boolean
          created_at?: string
          current_bet?: number
          display_name?: string
          folded?: boolean
          has_acted?: boolean
          id?: string
          in_hand?: boolean
          is_bot?: boolean
          last_action?: string | null
          seat_index: number
          shown_cards?: Json | null
          stack?: number
          table_id: string
          total_committed?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          all_in?: boolean
          created_at?: string
          current_bet?: number
          display_name?: string
          folded?: boolean
          has_acted?: boolean
          id?: string
          in_hand?: boolean
          is_bot?: boolean
          last_action?: string | null
          seat_index?: number
          shown_cards?: Json | null
          stack?: number
          table_id?: string
          total_committed?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poker_seats_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "poker_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_tables: {
        Row: {
          big_blind: number
          created_at: string
          host_id: string
          id: string
          is_private: boolean
          max_seats: number
          name: string
          small_blind: number
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          big_blind?: number
          created_at?: string
          host_id: string
          id?: string
          is_private?: boolean
          max_seats?: number
          name: string
          small_blind?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          big_blind?: number
          created_at?: string
          host_id?: string
          id?: string
          is_private?: boolean
          max_seats?: number
          name?: string
          small_blind?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward?: number
        }
        Relationships: []
      }
      scan_history: {
        Row: {
          collection: string | null
          created_at: string
          id: string
          items: Json
          mode: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          collection?: string | null
          created_at?: string
          id?: string
          items?: Json
          mode?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          collection?: string | null
          created_at?: string
          id?: string
          items?: Json
          mode?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          plan: string | null
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          plan?: string | null
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          plan?: string | null
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_monthly_game_prizes: { Args: never; Returns: number }
      claim_ad_reward_for: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          claims_today: number
          daily_limit: number
          status: string
        }[]
      }
      claim_daily_checkin_for: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          current_streak: number
          rewarded: number
          status: string
        }[]
      }
      claim_free_scan_for: { Args: { _user_id: string }; Returns: boolean }
      claim_signup_grant_for: {
        Args: { _device_hash: string; _user_id: string }
        Returns: {
          balance: number
          status: string
        }[]
      }
      ensure_credit_account: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          created_at: string
          last_daily_grant_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_active_user_plan: {
        Args: { _env?: string; _user_id: string }
        Returns: string
      }
      get_ad_reward_status_for: {
        Args: { _user_id: string }
        Returns: {
          claims_today: number
          daily_limit: number
        }[]
      }
      get_admin_usage_stats: {
        Args: never
        Returns: {
          purchases_month: number
          revenue_month_cents: number
          scans_month: number
          scans_today: number
          scans_week: number
          visitors_month: number
          visitors_today: number
          visitors_week: number
        }[]
      }
      get_checkin_state_for: {
        Args: { _user_id: string }
        Returns: {
          checked_in_today: boolean
          current_streak: number
          last_checkin_date: string
          longest_streak: number
          total_rewards: number
        }[]
      }
      get_credit_state_for: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          free_scan_available: boolean
          last_daily_grant_at: string
        }[]
      }
      get_game_leaderboard: {
        Args: { _limit: number; _scope: string; _user_id?: string }
        Returns: {
          display_name: string
          is_me: boolean
          rank: number
          time_ms: number
        }[]
      }
      get_referral_code_for: { Args: { _user_id: string }; Returns: string }
      get_referral_stats_for: {
        Args: { _user_id: string }
        Returns: {
          code: string
          credits_earned: number
          invited: number
          redeemed: boolean
        }[]
      }
      get_scan_economics: {
        Args: { _days?: number }
        Returns: {
          avg_scan_cost_micro_usd: number
          scans: number
          total_cost_micro_usd: number
        }[]
      }
      grant_credits: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_seated_at_poker_table: {
        Args: { _table_id: string; _user_id: string }
        Returns: boolean
      }
      record_account_visit: { Args: { _user_id: string }; Returns: undefined }
      redeem_play_purchase: {
        Args: {
          _credits: number
          _order_id: string
          _product_id: string
          _purchase_token: string
          _user_id: string
        }
        Returns: {
          balance: number
          status: string
        }[]
      }
      redeem_referral_code_for: {
        Args: { _code: string; _user_id: string }
        Returns: {
          reward: number
          status: string
        }[]
      }
      refund_credits_for: {
        Args: { _amount: number; _reason: string; _user_id: string }
        Returns: number
      }
      release_free_scan_for: { Args: { _user_id: string }; Returns: undefined }
      spend_credits_for: {
        Args: {
          _amount: number
          _metadata?: Json
          _reason: string
          _user_id: string
        }
        Returns: number
      }
      submit_game_score: {
        Args: { _display_name: string; _time_ms: number; _user_id: string }
        Returns: {
          best_alltime_ms: number
          best_month_ms: number
          status: string
        }[]
      }
      transfer_credits_for: {
        Args: { _amount: number; _recipient_email: string; _sender_id: string }
        Returns: {
          balance: number
          recipient_email: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
