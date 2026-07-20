// Tipos do banco escritos à mão no formato do codegen do supabase-js v2.
// Refletem o estado pós-migration 0002 (supabase/migrations/).
// Se o schema mudar, atualize este arquivo junto com a migration.

export type Role = 'colaborador' | 'gestor'
export type TipoSolicitacao = 'NOVA' | 'ALTERACAO'
export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'REJEITADA'

export type Database = {
  public: {
    Tables: {
      areas: {
        Row: { id: string; nome: string }
        Insert: { id?: string; nome: string }
        Update: { id?: string; nome?: string }
        Relationships: []
      }
      demandas: {
        Row: {
          id: string
          area_id: string
          nome: string
          tempo_padrao_min: number | null
          variavel: boolean
          ativo: boolean
          blocos_totais: number
        }
        Insert: {
          id?: string
          area_id: string
          nome: string
          tempo_padrao_min?: number | null
          variavel?: boolean
          ativo?: boolean
          blocos_totais?: number
        }
        Update: {
          id?: string
          area_id?: string
          nome?: string
          tempo_padrao_min?: number | null
          variavel?: boolean
          ativo?: boolean
          blocos_totais?: number
        }
        Relationships: [
          {
            foreignKeyName: 'demandas_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      colaboradores: {
        Row: {
          id: string
          nome: string
          area_id: string | null
          carga_horaria_min: number
          role: Role
          ativo: boolean
        }
        Insert: {
          id: string
          nome: string
          area_id?: string | null
          carga_horaria_min?: number
          role?: Role
          ativo?: boolean
        }
        Update: {
          id?: string
          nome?: string
          area_id?: string | null
          carga_horaria_min?: number
          role?: Role
          ativo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'colaboradores_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      apontamentos: {
        Row: {
          id: string
          colaborador_id: string
          demanda_id: string
          data: string
          quantidade: number
          tempo_manual_min: number | null
          observacoes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          colaborador_id: string
          demanda_id: string
          data?: string
          quantidade?: number
          tempo_manual_min?: number | null
          observacoes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          colaborador_id?: string
          demanda_id?: string
          data?: string
          quantidade?: number
          tempo_manual_min?: number | null
          observacoes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'apontamentos_colaborador_id_fkey'
            columns: ['colaborador_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'apontamentos_demanda_id_fkey'
            columns: ['demanda_id']
            isOneToOne: false
            referencedRelation: 'demandas'
            referencedColumns: ['id']
          },
        ]
      }
      solicitacoes_demandas: {
        Row: {
          id: string
          colaborador_id: string
          area_id: string
          demanda_id: string | null
          tipo: TipoSolicitacao
          nome: string
          tempo_padrao_min: number | null
          variavel: boolean
          blocos_totais: number
          ativo: boolean | null
          status: StatusSolicitacao
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          colaborador_id: string
          area_id: string
          demanda_id?: string | null
          tipo: TipoSolicitacao
          nome: string
          tempo_padrao_min?: number | null
          variavel?: boolean
          blocos_totais?: number
          ativo?: boolean | null
          status?: StatusSolicitacao
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          colaborador_id?: string
          area_id?: string
          demanda_id?: string | null
          tipo?: TipoSolicitacao
          nome?: string
          tempo_padrao_min?: number | null
          variavel?: boolean
          blocos_totais?: number
          ativo?: boolean | null
          status?: StatusSolicitacao
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: 'solicitacoes_demandas_colaborador_id_fkey'
            columns: ['colaborador_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'solicitacoes_demandas_area_id_fkey'
            columns: ['area_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'solicitacoes_demandas_demanda_id_fkey'
            columns: ['demanda_id']
            isOneToOne: false
            referencedRelation: 'demandas'
            referencedColumns: ['id']
          },
        ]
      }
      notificacoes: {
        Row: {
          id: string
          destinatario_id: string
          tipo: string
          titulo: string
          mensagem: string | null
          link: string | null
          lida: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          destinatario_id: string
          tipo: string
          titulo: string
          mensagem?: string | null
          link?: string | null
          lida?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          destinatario_id?: string
          tipo?: string
          titulo?: string
          mensagem?: string | null
          link?: string | null
          lida?: boolean
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notificacoes_destinatario_id_fkey'
            columns: ['destinatario_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      apontamentos_calculado: {
        Row: {
          id: string
          colaborador_id: string
          demanda_id: string
          data: string
          quantidade: number
          tempo_manual_min: number | null
          observacoes: string | null
          created_at: string
          area_id: string
          tempo_total_min: number
        }
        Relationships: [
          {
            foreignKeyName: 'apontamentos_colaborador_id_fkey'
            columns: ['colaborador_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'apontamentos_demanda_id_fkey'
            columns: ['demanda_id']
            isOneToOne: false
            referencedRelation: 'demandas'
            referencedColumns: ['id']
          },
        ]
      }
      indicadores_diarios: {
        Row: {
          colaborador_id: string
          nome: string
          area_id: string | null
          ativo: boolean
          // null quando o colaborador não tem nenhum apontamento (LEFT JOIN)
          data: string | null
          carga_horaria_min: number
          tempo_entregue_min: number
          indice: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_role: { Args: Record<string, never>; Returns: string | null }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
