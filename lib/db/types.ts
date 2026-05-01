export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          chips_per_paise: number;
          id: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          chips_per_paise?: number;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          chips_per_paise?: number;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: Database['public']['Enums']['audit_action'];
          actor_user_id: string;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          entity_id: string | null;
          id: string;
          session_id: string;
        };
        Insert: {
          action: Database['public']['Enums']['audit_action'];
          actor_user_id: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          id?: string;
          session_id: string;
        };
        Update: {
          action?: Database['public']['Enums']['audit_action'];
          actor_user_id?: string;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_log_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      badges: {
        Row: {
          badge_key: string;
          earned_at: string;
          id: string;
          session_id: string | null;
          user_id: string;
        };
        Insert: {
          badge_key: string;
          earned_at?: string;
          id?: string;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          badge_key?: string;
          earned_at?: string;
          id?: string;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'badges_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      buyins: {
        Row: {
          amount_paise: number;
          chips: number;
          id: string;
          recorded_at: string;
          recorded_by: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          amount_paise: number;
          chips: number;
          id?: string;
          recorded_at?: string;
          recorded_by: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          amount_paise?: number;
          chips?: number;
          id?: string;
          recorded_at?: string;
          recorded_by?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'buyins_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      cashouts: {
        Row: {
          amount_paise: number;
          chip_count: number;
          confirmed_at: string | null;
          confirmed_by: string | null;
          id: string;
          session_id: string;
          status: Database['public']['Enums']['cashout_status'];
          submitted_at: string;
          submitted_by: string;
          user_id: string;
        };
        Insert: {
          amount_paise: number;
          chip_count: number;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          id?: string;
          session_id: string;
          status?: Database['public']['Enums']['cashout_status'];
          submitted_at?: string;
          submitted_by: string;
          user_id: string;
        };
        Update: {
          amount_paise?: number;
          chip_count?: number;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          id?: string;
          session_id?: string;
          status?: Database['public']['Enums']['cashout_status'];
          submitted_at?: string;
          submitted_by?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashouts_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      notes: {
        Row: {
          author_user_id: string;
          body: string;
          created_at: string;
          id: string;
          session_id: string;
          updated_at: string;
        };
        Insert: {
          author_user_id: string;
          body: string;
          created_at?: string;
          id?: string;
          session_id: string;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      photos: {
        Row: {
          caption: string | null;
          created_at: string;
          id: string;
          session_id: string;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          session_id: string;
          storage_path: string;
          uploaded_by: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          id?: string;
          session_id?: string;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          nickname: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          nickname: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          nickname?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      session_participants: {
        Row: {
          joined_at: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'session_participants_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      sessions: {
        Row: {
          blinds_big: number;
          blinds_small: number;
          chips_per_paise: number;
          closed_at: string | null;
          created_by: string;
          id: string;
          invite_token: string;
          location: string | null;
          name: string | null;
          opened_at: string;
          played_on: string;
          status: Database['public']['Enums']['session_status'];
        };
        Insert: {
          blinds_big: number;
          blinds_small: number;
          chips_per_paise: number;
          closed_at?: string | null;
          created_by: string;
          id?: string;
          invite_token?: string;
          location?: string | null;
          name?: string | null;
          opened_at?: string;
          played_on?: string;
          status?: Database['public']['Enums']['session_status'];
        };
        Update: {
          blinds_big?: number;
          blinds_small?: number;
          chips_per_paise?: number;
          closed_at?: string | null;
          created_by?: string;
          id?: string;
          invite_token?: string;
          location?: string | null;
          name?: string | null;
          opened_at?: string;
          played_on?: string;
          status?: Database['public']['Enums']['session_status'];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_session_house: { Args: { s: string }; Returns: boolean };
      is_session_participant: { Args: { s: string }; Returns: boolean };
      join_session_with_token: {
        Args: { token: string };
        Returns: {
          blinds_big: number;
          blinds_small: number;
          chips_per_paise: number;
          closed_at: string | null;
          created_by: string;
          id: string;
          invite_token: string;
          location: string | null;
          name: string | null;
          opened_at: string;
          played_on: string;
          status: Database['public']['Enums']['session_status'];
        };
        SetofOptions: {
          from: '*';
          to: 'sessions';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      audit_action:
        | 'buyin_create'
        | 'buyin_edit'
        | 'buyin_delete'
        | 'cashout_submit'
        | 'cashout_edit'
        | 'cashout_confirm'
        | 'session_open'
        | 'session_close';
      cashout_status: 'pending' | 'confirmed';
      session_status: 'open' | 'closed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      audit_action: [
        'buyin_create',
        'buyin_edit',
        'buyin_delete',
        'cashout_submit',
        'cashout_edit',
        'cashout_confirm',
        'session_open',
        'session_close',
      ],
      cashout_status: ['pending', 'confirmed'],
      session_status: ['open', 'closed'],
    },
  },
} as const;
