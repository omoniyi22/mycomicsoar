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
      cart_items: {
        Row: {
          comic_id: string
          created_at: string
          id: string
          quantity: number
          user_id: string
        }
        Insert: {
          comic_id: string
          created_at?: string
          id?: string
          quantity?: number
          user_id: string
        }
        Update: {
          comic_id?: string
          created_at?: string
          id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_pages: {
        Row: {
          comic_id: string
          created_at: string
          height: number | null
          id: string
          image_path: string | null
          image_path_landscape: string | null
          page_index: number
          width: number | null
        }
        Insert: {
          comic_id: string
          created_at?: string
          height?: number | null
          id?: string
          image_path?: string | null
          image_path_landscape?: string | null
          page_index: number
          width?: number | null
        }
        Update: {
          comic_id?: string
          created_at?: string
          height?: number | null
          id?: string
          image_path?: string | null
          image_path_landscape?: string | null
          page_index?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comic_pages_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
        ]
      }
      comics: {
        Row: {
          artist: string | null
          cover_url: string | null
          created_at: string
          format: string | null
          genre: string | null
          id: string
          is_bestseller: boolean
          is_featured: boolean
          is_graphic_novel: boolean
          is_manga: boolean
          is_new: boolean
          is_trending: boolean
          page_count: number
          pdf_path: string | null
          pdf_path_landscape: string | null
          price: number
          price_eur: number | null
          price_ngn: number | null
          published_at: string | null
          publisher_id: string | null
          rating: number
          release_date: string | null
          slug: string
          status: string
          synopsis: string | null
          title: string
          writer: string | null
        }
        Insert: {
          artist?: string | null
          cover_url?: string | null
          created_at?: string
          format?: string | null
          genre?: string | null
          id?: string
          is_bestseller?: boolean
          is_featured?: boolean
          is_graphic_novel?: boolean
          is_manga?: boolean
          is_new?: boolean
          is_trending?: boolean
          page_count?: number
          pdf_path?: string | null
          pdf_path_landscape?: string | null
          price?: number
          price_eur?: number | null
          price_ngn?: number | null
          published_at?: string | null
          publisher_id?: string | null
          rating?: number
          release_date?: string | null
          slug: string
          status?: string
          synopsis?: string | null
          title: string
          writer?: string | null
        }
        Update: {
          artist?: string | null
          cover_url?: string | null
          created_at?: string
          format?: string | null
          genre?: string | null
          id?: string
          is_bestseller?: boolean
          is_featured?: boolean
          is_graphic_novel?: boolean
          is_manga?: boolean
          is_new?: boolean
          is_trending?: boolean
          page_count?: number
          pdf_path?: string | null
          pdf_path_landscape?: string | null
          price?: number
          price_eur?: number | null
          price_ngn?: number | null
          published_at?: string | null
          publisher_id?: string | null
          rating?: number
          release_date?: string | null
          slug?: string
          status?: string
          synopsis?: string | null
          title?: string
          writer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comics_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          status: string | null
          subject: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          status?: string | null
          subject: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string | null
          subject?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          source: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          comic_id: string
          id: string
          order_id: string
          quantity: number
          title: string
          unit_price: number
        }
        Insert: {
          comic_id: string
          id?: string
          order_id: string
          quantity?: number
          title: string
          unit_price?: number
        }
        Update: {
          comic_id?: string
          id?: string
          order_id?: string
          quantity?: number
          title?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          email: string | null
          id: string
          is_guest: boolean
          payment_provider: string | null
          payment_reference: string | null
          status: string
          status_detail: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_guest?: boolean
          payment_provider?: string | null
          payment_reference?: string | null
          status?: string
          status_detail?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_guest?: boolean
          payment_provider?: string | null
          payment_reference?: string | null
          status?: string
          status_detail?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      publishers: {
        Row: {
          accent: string | null
          created_at: string
          id: string
          name: string
          slug: string
          tagline: string | null
        }
        Insert: {
          accent?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          tagline?: string | null
        }
        Update: {
          accent?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tagline?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          comic_id: string
          download_count: number
          id: string
          last_downloaded_at: string | null
          price_paid: number
          purchased_at: string
          user_id: string
        }
        Insert: {
          comic_id: string
          download_count?: number
          id?: string
          last_downloaded_at?: string | null
          price_paid?: number
          purchased_at?: string
          user_id: string
        }
        Update: {
          comic_id?: string
          download_count?: number
          id?: string
          last_downloaded_at?: string | null
          price_paid?: number
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
        ]
      }
      soundtracks: {
        Row: {
          artist: string | null
          audio_path: string
          created_at: string
          duration_seconds: number | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          artist?: string | null
          audio_path: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          artist?: string | null
          audio_path?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_soundtracks: {
        Row: {
          audio_path: string
          created_at: string
          duration_seconds: number | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          audio_path: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          audio_path?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          comic_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comic_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comic_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_comic_id_fkey"
            columns: ["comic_id"]
            isOneToOne: false
            referencedRelation: "comics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
