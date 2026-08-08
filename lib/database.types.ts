// Aliases de conveniência para os enums de aplicação (não vêm do codegen do
// Supabase — os `check` constraints ficam como `string` no tipo gerado).
// Mantidos à mão; nada aqui muda com a Fase 1 (organizacoes/planos/convites).

export type Role = 'colaborador' | 'gestor'
export type TipoSolicitacao = 'NOVA' | 'ALTERACAO'
export type StatusSolicitacao = 'PENDENTE' | 'APROVADA' | 'REJEITADA'
export type PrioridadeCartao = 'baixa' | 'media' | 'alta'
export type TipoCampoFormulario = 'texto' | 'texto_longo' | 'selecao' | 'data' | 'prioridade'
export type MapeamentoCampoFormulario = 'titulo' | 'descricao' | 'prazo' | 'prioridade' | 'personalizado'
export type TipoCartao = 'Padrão' | 'Bug' | 'Melhoria' | 'Solicitação'
export type TipoComentarioCartao = 'usuario' | 'sistema'
export type StatusAprovacaoCartao = 'PENDENTE' | 'APROVADA' | 'REJEITADA'
export type TipoCampoCustomizado = 'texto' | 'numero' | 'data' | 'selecao' | 'pessoa' | 'checkbox' | 'url'
// 'cortado' = a trava anti-loop do dispatcher agiu (ver lib/automacoes.ts).
export type StatusExecucaoAutomacao = 'ok' | 'erro' | 'cortado'


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
      apontamentos: {
        Row: {
          blocos_totais_snapshot: number
          cartao_sessao_id: string | null
          colaborador_id: string
          created_at: string
          data: string
          demanda_id: string
          id: string
          motivo: string | null
          observacoes: string | null
          organizacao_id: string
          quantidade: number
          tempo_manual_min: number | null
          tempo_padrao_snapshot: number | null
        }
        Insert: {
          blocos_totais_snapshot?: number
          cartao_sessao_id?: string | null
          colaborador_id: string
          created_at?: string
          data?: string
          demanda_id: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
          organizacao_id?: string
          quantidade?: number
          tempo_manual_min?: number | null
          tempo_padrao_snapshot?: number | null
        }
        Update: {
          blocos_totais_snapshot?: number
          cartao_sessao_id?: string | null
          colaborador_id?: string
          created_at?: string
          data?: string
          demanda_id?: string
          id?: string
          motivo?: string | null
          observacoes?: string | null
          organizacao_id?: string
          quantidade?: number
          tempo_manual_min?: number | null
          tempo_padrao_snapshot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apontamentos_cartao_sessao_id_fkey"
            columns: ["cartao_sessao_id"]
            isOneToOne: false
            referencedRelation: "cartoes_sessoes_tempo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_colaborador_org"
            columns: ["colaborador_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "apontamentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      apontamentos_correcoes: {
        Row: {
          apontamento_id: string | null
          colaborador_id: string
          criado_em: string
          data: string
          decidido_em: string | null
          decidido_por: string | null
          demanda_id: string
          id: string
          justificativa: string
          motivo: string | null
          observacoes: string | null
          organizacao_id: string
          quantidade: number
          status: Database["public"]["Enums"]["status_solicitacao"]
          tempo_manual_min: number | null
        }
        Insert: {
          apontamento_id?: string | null
          colaborador_id: string
          criado_em?: string
          data: string
          decidido_em?: string | null
          decidido_por?: string | null
          demanda_id: string
          id?: string
          justificativa: string
          motivo?: string | null
          observacoes?: string | null
          organizacao_id?: string
          quantidade: number
          status?: Database["public"]["Enums"]["status_solicitacao"]
          tempo_manual_min?: number | null
        }
        Update: {
          apontamento_id?: string | null
          colaborador_id?: string
          criado_em?: string
          data?: string
          decidido_em?: string | null
          decidido_por?: string | null
          demanda_id?: string
          id?: string
          justificativa?: string
          motivo?: string | null
          observacoes?: string | null
          organizacao_id?: string
          quantidade?: number
          status?: Database["public"]["Enums"]["status_solicitacao"]
          tempo_manual_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apontamentos_correcoes_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "apontamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_correcoes_apontamento_id_fkey"
            columns: ["apontamento_id"]
            isOneToOne: false
            referencedRelation: "apontamentos_calculado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_correcoes_colaborador_org"
            columns: ["colaborador_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "apontamentos_correcoes_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_correcoes_decidido_por_fkey"
            columns: ["decidido_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "apontamentos_correcoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_correcoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          ativo: boolean
          id: string
          nome: string
          organizacao_id: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          nome: string
          organizacao_id?: string
        }
        Update: {
          ativo?: boolean
          id?: string
          nome?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          ator_id: string
          criado_em: string
          dados_antes: Json | null
          dados_depois: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          organizacao_id: string
        }
        Insert: {
          acao: string
          ator_id: string
          criado_em?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          organizacao_id?: string
        }
        Update: {
          acao?: string
          ator_id?: string
          criado_em?: string
          dados_antes?: Json | null
          dados_depois?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_ator_org"
            columns: ["ator_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "auditoria_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      automacoes: {
        Row: {
          ativa: boolean
          created_at: string
          criado_por: string | null
          evento: string
          evento_config: Json
          id: string
          nome: string
          organizacao_id: string
          posicao: number
          quadro_id: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          criado_por?: string | null
          evento: string
          evento_config?: Json
          id?: string
          nome: string
          organizacao_id?: string
          posicao?: number
          quadro_id: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          criado_por?: string | null
          evento?: string
          evento_config?: Json
          id?: string
          nome?: string
          organizacao_id?: string
          posicao?: number
          quadro_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automacoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "automacoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automacoes_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      automacoes_acoes: {
        Row: {
          automacao_id: string
          config: Json
          id: string
          ordem: number
          organizacao_id: string
          tipo: string
        }
        Insert: {
          automacao_id: string
          config?: Json
          id?: string
          ordem: number
          organizacao_id?: string
          tipo: string
        }
        Update: {
          automacao_id?: string
          config?: Json
          id?: string
          ordem?: number
          organizacao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_acoes_automacao_org"
            columns: ["automacao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "automacoes_acoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      automacoes_execucoes: {
        Row: {
          acoes_executadas: number
          automacao_id: string
          cartao_id: string | null
          erro: string | null
          executado_em: string
          id: string
          organizacao_id: string
          status: string
        }
        Insert: {
          acoes_executadas?: number
          automacao_id: string
          cartao_id?: string | null
          erro?: string | null
          executado_em?: string
          id?: string
          organizacao_id?: string
          status: string
        }
        Update: {
          acoes_executadas?: number
          automacao_id?: string
          cartao_id?: string | null
          erro?: string | null
          executado_em?: string
          id?: string
          organizacao_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_execucoes_automacao_org"
            columns: ["automacao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "automacoes_execucoes_cartao_id_fkey"
            columns: ["cartao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automacoes_execucoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes: {
        Row: {
          cartao_pai_id: string | null
          centro_id: string | null
          codigo: string
          coluna_id: string
          created_at: string
          criado_por: string | null
          demanda_id: string | null
          descricao: string | null
          entregue_em: string | null
          etapa_desde: string | null
          id: string
          inicio_desejado: string | null
          organizacao_id: string
          posicao: number
          prazo: string | null
          prioridade: string
          proxima_recorrencia_em: string | null
          recorrencia: Json | null
          tag_referencia: string | null
          tempo_estimado_min: number | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cartao_pai_id?: string | null
          centro_id?: string | null
          codigo: string
          coluna_id: string
          created_at?: string
          criado_por?: string | null
          demanda_id?: string | null
          descricao?: string | null
          entregue_em?: string | null
          etapa_desde?: string | null
          id?: string
          inicio_desejado?: string | null
          organizacao_id?: string
          posicao: number
          prazo?: string | null
          prioridade?: string
          proxima_recorrencia_em?: string | null
          recorrencia?: Json | null
          tag_referencia?: string | null
          tempo_estimado_min?: number | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          cartao_pai_id?: string | null
          centro_id?: string | null
          codigo?: string
          coluna_id?: string
          created_at?: string
          criado_por?: string | null
          demanda_id?: string | null
          descricao?: string | null
          entregue_em?: string | null
          etapa_desde?: string | null
          id?: string
          inicio_desejado?: string | null
          organizacao_id?: string
          posicao?: number
          prazo?: string | null
          prioridade?: string
          proxima_recorrencia_em?: string | null
          recorrencia?: Json | null
          tag_referencia?: string | null
          tempo_estimado_min?: number | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_cartao_pai_id_fkey"
            columns: ["cartao_pai_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_centro_id_fkey"
            columns: ["centro_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_coluna_org"
            columns: ["coluna_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colunas"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_anexos: {
        Row: {
          caminho_storage: string
          cartao_id: string
          colaborador_id: string
          created_at: string
          id: string
          nome_arquivo: string
          organizacao_id: string
          tamanho_bytes: number
          tipo_mime: string
        }
        Insert: {
          caminho_storage: string
          cartao_id: string
          colaborador_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          organizacao_id?: string
          tamanho_bytes: number
          tipo_mime: string
        }
        Update: {
          caminho_storage?: string
          cartao_id?: string
          colaborador_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          organizacao_id?: string
          tamanho_bytes?: number
          tipo_mime?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_anexos_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_anexos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_anexos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_anexos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_aprovacoes: {
        Row: {
          aprovador_id: string
          atualizado_em: string
          cartao_id: string
          comentario: string | null
          criado_em: string
          id: string
          organizacao_id: string
          solicitado_por: string
          status: Database["public"]["Enums"]["status_aprovacao_cartao"]
        }
        Insert: {
          aprovador_id: string
          atualizado_em?: string
          cartao_id: string
          comentario?: string | null
          criado_em?: string
          id?: string
          organizacao_id?: string
          solicitado_por: string
          status?: Database["public"]["Enums"]["status_aprovacao_cartao"]
        }
        Update: {
          aprovador_id?: string
          atualizado_em?: string
          cartao_id?: string
          comentario?: string | null
          criado_em?: string
          id?: string
          organizacao_id?: string
          solicitado_por?: string
          status?: Database["public"]["Enums"]["status_aprovacao_cartao"]
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_aprovacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_aprovacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_aprovacoes_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_aprovacoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_aprovacoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_aprovacoes_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
        ]
      }
      cartoes_campos_valores: {
        Row: {
          atualizado_em: string
          campo_id: string
          cartao_id: string
          organizacao_id: string
          valor: Json | null
        }
        Insert: {
          atualizado_em?: string
          campo_id: string
          cartao_id: string
          organizacao_id?: string
          valor?: Json | null
        }
        Update: {
          atualizado_em?: string
          campo_id?: string
          cartao_id?: string
          organizacao_id?: string
          valor?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_campos_valores_campo_id_fkey"
            columns: ["campo_id"]
            isOneToOne: false
            referencedRelation: "quadros_campos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_campos_valores_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_campos_valores_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_checklist_itens: {
        Row: {
          cartao_id: string
          concluido: boolean
          created_at: string
          id: string
          organizacao_id: string
          posicao: number
          texto: string
        }
        Insert: {
          cartao_id: string
          concluido?: boolean
          created_at?: string
          id?: string
          organizacao_id?: string
          posicao?: number
          texto: string
        }
        Update: {
          cartao_id?: string
          concluido?: boolean
          created_at?: string
          id?: string
          organizacao_id?: string
          posicao?: number
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_checklist_itens_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_checklist_itens_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_dependencias: {
        Row: {
          cartao_id: string
          criado_em: string
          criado_por: string | null
          depende_de_id: string
          id: string
          organizacao_id: string
        }
        Insert: {
          cartao_id: string
          criado_em?: string
          criado_por?: string | null
          depende_de_id: string
          id?: string
          organizacao_id?: string
        }
        Update: {
          cartao_id?: string
          criado_em?: string
          criado_por?: string | null
          depende_de_id?: string
          id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_dependencias_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_dependencias_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_dependencias_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_dependencias_depende_de_id_fkey"
            columns: ["depende_de_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_dependencias_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_emails: {
        Row: {
          assunto: string
          cartao_id: string
          colaborador_id: string
          corpo: string
          destinatario: string
          enviado_em: string
          id: string
          organizacao_id: string
        }
        Insert: {
          assunto: string
          cartao_id: string
          colaborador_id: string
          corpo: string
          destinatario: string
          enviado_em?: string
          id?: string
          organizacao_id?: string
        }
        Update: {
          assunto?: string
          cartao_id?: string
          colaborador_id?: string
          corpo?: string
          destinatario?: string
          enviado_em?: string
          id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_emails_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_emails_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_emails_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_emails_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_etiquetas: {
        Row: {
          cartao_id: string
          etiqueta_id: string
          organizacao_id: string
        }
        Insert: {
          cartao_id: string
          etiqueta_id: string
          organizacao_id?: string
        }
        Update: {
          cartao_id?: string
          etiqueta_id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_etiquetas_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_etiquetas_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "etiquetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_etiquetas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_predecessores: {
        Row: {
          cartao_id: string
          criado_em: string
          organizacao_id: string
          predecessor_id: string
        }
        Insert: {
          cartao_id: string
          criado_em?: string
          organizacao_id?: string
          predecessor_id: string
        }
        Update: {
          cartao_id?: string
          criado_em?: string
          organizacao_id?: string
          predecessor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_predecessores_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_predecessores_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_predecessores_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_requisitos_status: {
        Row: {
          cartao_id: string
          concluido: boolean
          concluido_em: string | null
          organizacao_id: string
          requisito_id: string
        }
        Insert: {
          cartao_id: string
          concluido?: boolean
          concluido_em?: string | null
          organizacao_id?: string
          requisito_id: string
        }
        Update: {
          cartao_id?: string
          concluido?: boolean
          concluido_em?: string | null
          organizacao_id?: string
          requisito_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_requisitos_status_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_requisitos_status_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_requisitos_status_requisito_id_fkey"
            columns: ["requisito_id"]
            isOneToOne: false
            referencedRelation: "colunas_requisitos"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_responsaveis: {
        Row: {
          cartao_id: string
          colaborador_id: string
          organizacao_id: string
        }
        Insert: {
          cartao_id: string
          colaborador_id: string
          organizacao_id?: string
        }
        Update: {
          cartao_id?: string
          colaborador_id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_responsaveis_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_responsaveis_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_responsaveis_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_responsaveis_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_seguidores: {
        Row: {
          cartao_id: string
          colaborador_id: string
          criado_em: string
          organizacao_id: string
        }
        Insert: {
          cartao_id: string
          colaborador_id: string
          criado_em?: string
          organizacao_id?: string
        }
        Update: {
          cartao_id?: string
          colaborador_id?: string
          criado_em?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_seguidores_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_seguidores_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_seguidores_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_seguidores_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_sequencia_responsaveis: {
        Row: {
          cartao_id: string
          colaborador_id: string
          entregue: boolean
          entregue_em: string | null
          id: string
          ordem: number
          organizacao_id: string
        }
        Insert: {
          cartao_id: string
          colaborador_id: string
          entregue?: boolean
          entregue_em?: string | null
          id?: string
          ordem: number
          organizacao_id?: string
        }
        Update: {
          cartao_id?: string
          colaborador_id?: string
          entregue?: boolean
          entregue_em?: string | null
          id?: string
          ordem?: number
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_sequencia_responsaveis_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_sequencia_responsaveis_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_sequencia_responsaveis_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_sequencia_responsaveis_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_sessoes_tempo: {
        Row: {
          cartao_id: string
          colaborador_id: string
          finalizado_em: string | null
          id: string
          iniciado_em: string
          minutos: number | null
          organizacao_id: string
        }
        Insert: {
          cartao_id: string
          colaborador_id: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          minutos?: number | null
          organizacao_id?: string
        }
        Update: {
          cartao_id?: string
          colaborador_id?: string
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string
          minutos?: number | null
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_sessoes_tempo_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "cartoes_sessoes_tempo_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_sessoes_tempo_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_sessoes_tempo_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_templates: {
        Row: {
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          organizacao_id: string
          prioridade: string
          quadro_id: string
          tempo_estimado_min: number | null
          tipo: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          organizacao_id?: string
          prioridade?: string
          quadro_id: string
          tempo_estimado_min?: number | null
          tipo?: string
          titulo: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          organizacao_id?: string
          prioridade?: string
          quadro_id?: string
          tempo_estimado_min?: number | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_templates_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_templates_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "cartoes_templates_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cartoes_templates_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          admin: boolean
          area_id: string | null
          ativo: boolean
          avatar_url: string | null
          carga_horaria_min: number
          id: string
          mfa_email_ativo: boolean
          nome: string
          notif_alerta_queda: boolean
          notif_lembrete_diario: boolean
          notif_relatorio_semanal: boolean
          notif_solicitacoes: boolean
          organizacao_id: string
          role: string
        }
        Insert: {
          admin?: boolean
          area_id?: string | null
          ativo?: boolean
          avatar_url?: string | null
          carga_horaria_min?: number
          id: string
          mfa_email_ativo?: boolean
          nome: string
          notif_alerta_queda?: boolean
          notif_lembrete_diario?: boolean
          notif_relatorio_semanal?: boolean
          notif_solicitacoes?: boolean
          organizacao_id?: string
          role?: string
        }
        Update: {
          admin?: boolean
          area_id?: string | null
          ativo?: boolean
          avatar_url?: string | null
          carga_horaria_min?: number
          id?: string
          mfa_email_ativo?: boolean
          nome?: string
          notif_alerta_queda?: boolean
          notif_lembrete_diario?: boolean
          notif_relatorio_semanal?: boolean
          notif_solicitacoes?: boolean
          organizacao_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      colunas: {
        Row: {
          created_at: string
          etapa_final: boolean
          id: string
          limite_wip: number | null
          nome: string
          organizacao_id: string
          posicao: number
          quadro_id: string
          sla_horas: number | null
        }
        Insert: {
          created_at?: string
          etapa_final?: boolean
          id?: string
          limite_wip?: number | null
          nome: string
          organizacao_id?: string
          posicao: number
          quadro_id: string
          sla_horas?: number | null
        }
        Update: {
          created_at?: string
          etapa_final?: boolean
          id?: string
          limite_wip?: number | null
          nome?: string
          organizacao_id?: string
          posicao?: number
          quadro_id?: string
          sla_horas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colunas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colunas_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      colunas_requisitos: {
        Row: {
          coluna_id: string
          created_at: string
          descricao: string
          id: string
          obrigatorio: boolean
          organizacao_id: string
          posicao: number
        }
        Insert: {
          coluna_id: string
          created_at?: string
          descricao: string
          id?: string
          obrigatorio?: boolean
          organizacao_id?: string
          posicao?: number
        }
        Update: {
          coluna_id?: string
          created_at?: string
          descricao?: string
          id?: string
          obrigatorio?: boolean
          organizacao_id?: string
          posicao?: number
        }
        Relationships: [
          {
            foreignKeyName: "colunas_requisitos_coluna_org"
            columns: ["coluna_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colunas"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "colunas_requisitos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_cartao: {
        Row: {
          cartao_id: string
          colaborador_id: string
          conteudo: string
          created_at: string
          id: string
          organizacao_id: string
          tipo: string
        }
        Insert: {
          cartao_id: string
          colaborador_id: string
          conteudo: string
          created_at?: string
          id?: string
          organizacao_id?: string
          tipo?: string
        }
        Update: {
          cartao_id?: string
          colaborador_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          organizacao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_cartao_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "comentarios_cartao_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_cartao_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "comentarios_cartao_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_push: {
        Row: {
          assunto: string
          chave_privada: string
          chave_publica: string
          criado_em: string
          id: boolean
        }
        Insert: {
          assunto?: string
          chave_privada: string
          chave_publica: string
          criado_em?: string
          id?: boolean
        }
        Update: {
          assunto?: string
          chave_privada?: string
          chave_publica?: string
          criado_em?: string
          id?: boolean
        }
        Relationships: []
      }
      convites: {
        Row: {
          aceito_em: string | null
          area_id: string | null
          convidado_por: string
          criado_em: string
          email: string
          expira_em: string
          id: string
          organizacao_id: string
          revogado_em: string | null
          role: string
          token_hash: string
        }
        Insert: {
          aceito_em?: string | null
          area_id?: string | null
          convidado_por: string
          criado_em?: string
          email: string
          expira_em?: string
          id?: string
          organizacao_id: string
          revogado_em?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          aceito_em?: string | null
          area_id?: string | null
          convidado_por?: string
          criado_em?: string
          email?: string
          expira_em?: string
          id?: string
          organizacao_id?: string
          revogado_em?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_area_org"
            columns: ["area_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "convites_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_execucoes: {
        Row: {
          chave: string
          executado_em: string
          id: string
          organizacao_id: string | null
          tipo: string
        }
        Insert: {
          chave: string
          executado_em?: string
          id?: string
          organizacao_id?: string | null
          tipo: string
        }
        Update: {
          chave?: string
          executado_em?: string
          id?: string
          organizacao_id?: string | null
          tipo?: string
        }
        Relationships: []
      }
      demandas: {
        Row: {
          area_id: string
          ativo: boolean
          blocos_totais: number
          finita: boolean
          id: string
          nome: string
          organizacao_id: string
          tempo_padrao_min: number | null
          variavel: boolean
        }
        Insert: {
          area_id: string
          ativo?: boolean
          blocos_totais?: number
          finita?: boolean
          id?: string
          nome: string
          organizacao_id?: string
          tempo_padrao_min?: number | null
          variavel?: boolean
        }
        Update: {
          area_id?: string
          ativo?: boolean
          blocos_totais?: number
          finita?: boolean
          id?: string
          nome?: string
          organizacao_id?: string
          tempo_padrao_min?: number | null
          variavel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demandas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      desafios_mfa: {
        Row: {
          codigo_hash: string
          colaborador_id: string
          criado_em: string
          expira_em: string
          id: string
          organizacao_id: string
          tentativas: number
          verificado_em: string | null
        }
        Insert: {
          codigo_hash: string
          colaborador_id: string
          criado_em?: string
          expira_em: string
          id?: string
          organizacao_id?: string
          tentativas?: number
          verificado_em?: string | null
        }
        Update: {
          codigo_hash?: string
          colaborador_id?: string
          criado_em?: string
          expira_em?: string
          id?: string
          organizacao_id?: string
          tentativas?: number
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "desafios_mfa_colaborador_org"
            columns: ["colaborador_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "desafios_mfa_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          organizacao_id: string
          quadro_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          organizacao_id?: string
          quadro_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          organizacao_id?: string
          quadro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "etiquetas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etiquetas_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      formularios: {
        Row: {
          ativo: boolean
          coluna_id: string
          cor_tema: string
          created_at: string
          criado_por: string
          descricao: string | null
          descricao_template: string | null
          id: string
          mensagem_sucesso: string
          mostrar_marca: boolean
          organizacao_id: string
          quadro_id: string
          slug: string
          titulo: string
          titulo_template: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          coluna_id: string
          cor_tema?: string
          created_at?: string
          criado_por: string
          descricao?: string | null
          descricao_template?: string | null
          id?: string
          mensagem_sucesso?: string
          mostrar_marca?: boolean
          organizacao_id?: string
          quadro_id: string
          slug: string
          titulo: string
          titulo_template?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          coluna_id?: string
          cor_tema?: string
          created_at?: string
          criado_por?: string
          descricao?: string | null
          descricao_template?: string | null
          id?: string
          mensagem_sucesso?: string
          mostrar_marca?: boolean
          organizacao_id?: string
          quadro_id?: string
          slug?: string
          titulo?: string
          titulo_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formularios_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "colunas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "formularios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      formularios_campos: {
        Row: {
          created_at: string
          formulario_id: string
          id: string
          mapeado_para: string
          obrigatorio: boolean
          opcoes: string[]
          organizacao_id: string
          placeholder: string | null
          posicao: number
          rotulo: string
          tipo: string
        }
        Insert: {
          created_at?: string
          formulario_id: string
          id?: string
          mapeado_para?: string
          obrigatorio?: boolean
          opcoes?: string[]
          organizacao_id?: string
          placeholder?: string | null
          posicao: number
          rotulo: string
          tipo: string
        }
        Update: {
          created_at?: string
          formulario_id?: string
          id?: string
          mapeado_para?: string
          obrigatorio?: boolean
          opcoes?: string[]
          organizacao_id?: string
          placeholder?: string | null
          posicao?: number
          rotulo?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "formularios_campos_formulario_org"
            columns: ["formulario_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "formularios_campos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_eventos: {
        Row: {
          atualizado_em: string
          cartao_id: string
          colaborador_id: string
          google_event_id: string
          organizacao_id: string
        }
        Insert: {
          atualizado_em?: string
          cartao_id: string
          colaborador_id: string
          google_event_id: string
          organizacao_id?: string
        }
        Update: {
          atualizado_em?: string
          cartao_id?: string
          colaborador_id?: string
          google_event_id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_eventos_cartao_org"
            columns: ["cartao_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "cartoes"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "google_calendar_eventos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_eventos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "google_calendar_eventos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      google_workspace_conexoes: {
        Row: {
          atualizado_em: string
          colaborador_id: string
          conectado_em: string
          email: string
          escopos: string[]
          organizacao_id: string
          refresh_token_cifrado: string
        }
        Insert: {
          atualizado_em?: string
          colaborador_id: string
          conectado_em?: string
          email: string
          escopos?: string[]
          organizacao_id?: string
          refresh_token_cifrado: string
        }
        Update: {
          atualizado_em?: string
          colaborador_id?: string
          conectado_em?: string
          email?: string
          escopos?: string[]
          organizacao_id?: string
          refresh_token_cifrado?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_workspace_conexoes_colaborador_org"
            columns: ["colaborador_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "google_workspace_conexoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          alvo: number
          area_id: string | null
          colaborador_id: string | null
          criado_em: string
          criado_por: string | null
          id: string
          organizacao_id: string
          vigente_desde: string
        }
        Insert: {
          alvo: number
          area_id?: string | null
          colaborador_id?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          organizacao_id?: string
          vigente_desde?: string
        }
        Update: {
          alvo?: number
          area_id?: string | null
          colaborador_id?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          organizacao_id?: string
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_colaborador_org"
            columns: ["colaborador_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "metas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "metas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string
          destinatario_id: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          organizacao_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          destinatario_id: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          organizacao_id?: string
          tipo: string
          titulo: string
        }
        Update: {
          criado_em?: string
          destinatario_id?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          organizacao_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_destinatario_org"
            columns: ["destinatario_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "notificacoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      operadores: {
        Row: {
          criado_em: string
          nome: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          nome: string
          user_id: string
        }
        Update: {
          criado_em?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      organizacoes: {
        Row: {
          criado_em: string
          excluir_em: string | null
          id: string
          limite_assentos: number
          nome: string
          plano_id: string
          slug: string
          status: string
          suspensa_em: string | null
          trial_expira_em: string | null
        }
        Insert: {
          criado_em?: string
          excluir_em?: string | null
          id?: string
          limite_assentos: number
          nome: string
          plano_id: string
          slug: string
          status?: string
          suspensa_em?: string | null
          trial_expira_em?: string | null
        }
        Update: {
          criado_em?: string
          excluir_em?: string | null
          id?: string
          limite_assentos?: number
          nome?: string
          plano_id?: string
          slug?: string
          status?: string
          suspensa_em?: string | null
          trial_expira_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizacoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          assentos_inclusos: number
          ativo: boolean
          codigo: string
          id: string
          nome: string
          ordem: number
          preco_mensal_centavos: number
        }
        Insert: {
          assentos_inclusos: number
          ativo?: boolean
          codigo: string
          id?: string
          nome: string
          ordem?: number
          preco_mensal_centavos?: number
        }
        Update: {
          assentos_inclusos?: number
          ativo?: boolean
          codigo?: string
          id?: string
          nome?: string
          ordem?: number
          preco_mensal_centavos?: number
        }
        Relationships: []
      }
      push_inscricoes: {
        Row: {
          auth: string
          colaborador_id: string
          criado_em: string
          endpoint: string
          id: string
          invalida_em: string | null
          organizacao_id: string
          p256dh: string
          ultimo_envio_em: string | null
        }
        Insert: {
          auth: string
          colaborador_id: string
          criado_em?: string
          endpoint: string
          id?: string
          invalida_em?: string | null
          organizacao_id?: string
          p256dh: string
          ultimo_envio_em?: string | null
        }
        Update: {
          auth?: string
          colaborador_id?: string
          criado_em?: string
          endpoint?: string
          id?: string
          invalida_em?: string | null
          organizacao_id?: string
          p256dh?: string
          ultimo_envio_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_inscricoes_colaborador_org"
            columns: ["colaborador_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "push_inscricoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      quadros: {
        Row: {
          ativo: boolean
          cartao_contador: number
          codigo: string
          created_at: string
          criado_por: string
          descricao: string | null
          id: string
          nome: string
          organizacao_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cartao_contador?: number
          codigo: string
          created_at?: string
          criado_por: string
          descricao?: string | null
          id?: string
          nome: string
          organizacao_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cartao_contador?: number
          codigo?: string
          created_at?: string
          criado_por?: string
          descricao?: string | null
          id?: string
          nome?: string
          organizacao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadros_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "quadros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      quadros_campos: {
        Row: {
          created_at: string
          id: string
          nome: string
          obrigatorio: boolean
          opcoes: string[]
          organizacao_id: string
          posicao: number
          quadro_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          obrigatorio?: boolean
          opcoes?: string[]
          organizacao_id?: string
          posicao?: number
          quadro_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          obrigatorio?: boolean
          opcoes?: string[]
          organizacao_id?: string
          posicao?: number
          quadro_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadros_campos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_campos_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      quadros_compartilhamentos: {
        Row: {
          ativo: boolean
          criado_em: string
          criado_por: string | null
          expira_em: string | null
          id: string
          organizacao_id: string
          quadro_id: string
          rotulo: string
          token: string
          ultimo_acesso_em: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          organizacao_id?: string
          quadro_id: string
          rotulo: string
          token?: string
          ultimo_acesso_em?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: string
          organizacao_id?: string
          quadro_id?: string
          rotulo?: string
          token?: string
          ultimo_acesso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quadros_compartilhamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_compartilhamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "quadros_compartilhamentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_compartilhamentos_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      quadros_membros: {
        Row: {
          adicionado_em: string
          colaborador_id: string
          organizacao_id: string
          quadro_id: string
        }
        Insert: {
          adicionado_em?: string
          colaborador_id: string
          organizacao_id?: string
          quadro_id: string
        }
        Update: {
          adicionado_em?: string
          colaborador_id?: string
          organizacao_id?: string
          quadro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadros_membros_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_membros_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "quadros_membros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_membros_quadro_org"
            columns: ["quadro_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      relatorios_agendados: {
        Row: {
          area_id: string | null
          ativo: boolean
          criado_em: string
          criado_por: string | null
          dia_semana: number
          id: string
          janela_dias_uteis: number
          nome: string
          organizacao_id: string
        }
        Insert: {
          area_id?: string | null
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          dia_semana?: number
          id?: string
          janela_dias_uteis?: number
          nome: string
          organizacao_id?: string
        }
        Update: {
          area_id?: string | null
          ativo?: boolean
          criado_em?: string
          criado_por?: string | null
          dia_semana?: number
          id?: string
          janela_dias_uteis?: number
          nome?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_agendados_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_agendados_criado_por_org"
            columns: ["criado_por", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "relatorios_agendados_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_agendados_destinatarios: {
        Row: {
          colaborador_id: string
          organizacao_id: string
          relatorio_id: string
        }
        Insert: {
          colaborador_id: string
          organizacao_id?: string
          relatorio_id: string
        }
        Update: {
          colaborador_id?: string
          organizacao_id?: string
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_agendados_destinatarios_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_agendados_destinatarios_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "relatorios_agendados_destinatarios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_agendados_destinatarios_relatorio_org"
            columns: ["relatorio_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "relatorios_agendados"
            referencedColumns: ["id", "organizacao_id"]
          },
        ]
      }
      solicitacoes_demandas: {
        Row: {
          area_id: string
          ativo: boolean | null
          atualizado_em: string
          blocos_totais: number
          colaborador_id: string
          criado_em: string
          demanda_id: string | null
          finita: boolean
          id: string
          nome: string
          organizacao_id: string
          status: Database["public"]["Enums"]["status_solicitacao"]
          tempo_padrao_min: number | null
          tipo: Database["public"]["Enums"]["tipo_solicitacao"]
          variavel: boolean
        }
        Insert: {
          area_id: string
          ativo?: boolean | null
          atualizado_em?: string
          blocos_totais?: number
          colaborador_id: string
          criado_em?: string
          demanda_id?: string | null
          finita?: boolean
          id?: string
          nome: string
          organizacao_id?: string
          status?: Database["public"]["Enums"]["status_solicitacao"]
          tempo_padrao_min?: number | null
          tipo: Database["public"]["Enums"]["tipo_solicitacao"]
          variavel?: boolean
        }
        Update: {
          area_id?: string
          ativo?: boolean | null
          atualizado_em?: string
          blocos_totais?: number
          colaborador_id?: string
          criado_em?: string
          demanda_id?: string | null
          finita?: boolean
          id?: string
          nome?: string
          organizacao_id?: string
          status?: Database["public"]["Enums"]["status_solicitacao"]
          tempo_padrao_min?: number | null
          tipo?: Database["public"]["Enums"]["tipo_solicitacao"]
          variavel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_demandas_area_org"
            columns: ["area_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "solicitacoes_demandas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_demandas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "indicadores_diarios"
            referencedColumns: ["colaborador_id"]
          },
          {
            foreignKeyName: "solicitacoes_demandas_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_demandas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      apontamentos_calculado: {
        Row: {
          area_id: string | null
          colaborador_id: string | null
          created_at: string | null
          data: string | null
          demanda_id: string | null
          id: string | null
          motivo: string | null
          observacoes: string | null
          organizacao_id: string | null
          quantidade: number | null
          tempo_manual_min: number | null
          tempo_total_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apontamentos_colaborador_org"
            columns: ["colaborador_id", "organizacao_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id", "organizacao_id"]
          },
          {
            foreignKeyName: "apontamentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apontamentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      demandas_acumulado: {
        Row: {
          acumulado: number | null
          demanda_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apontamentos_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_diarios: {
        Row: {
          area_id: string | null
          ativo: boolean | null
          carga_horaria_min: number | null
          colaborador_id: string | null
          data: string | null
          indice: number | null
          nome: string | null
          tempo_entregue_min: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aprovar_cartao: {
        Args: { p_id: string }
        Returns: {
          aprovador_id: string
          atualizado_em: string
          cartao_id: string
          comentario: string | null
          criado_em: string
          id: string
          organizacao_id: string
          solicitado_por: string
          status: Database["public"]["Enums"]["status_aprovacao_cartao"]
        }
        SetofOptions: {
          from: "*"
          to: "cartoes_aprovacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aprovar_correcao_apontamento: {
        Args: { p_id: string }
        Returns: {
          blocos_totais_snapshot: number
          cartao_sessao_id: string | null
          colaborador_id: string
          created_at: string
          data: string
          demanda_id: string
          id: string
          motivo: string | null
          observacoes: string | null
          organizacao_id: string
          quantidade: number
          tempo_manual_min: number | null
          tempo_padrao_snapshot: number | null
        }
        SetofOptions: {
          from: "*"
          to: "apontamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aprovar_solicitacao: {
        Args: { p_id: string }
        Returns: {
          area_id: string
          ativo: boolean | null
          atualizado_em: string
          blocos_totais: number
          colaborador_id: string
          criado_em: string
          demanda_id: string | null
          finita: boolean
          id: string
          nome: string
          organizacao_id: string
          status: Database["public"]["Enums"]["status_solicitacao"]
          tempo_padrao_min: number | null
          tipo: Database["public"]["Enums"]["tipo_solicitacao"]
          variavel: boolean
        }
        SetofOptions: {
          from: "*"
          to: "solicitacoes_demandas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assentos_ocupados: { Args: { p_org: string }; Returns: number }
      atualizar_apontamento: {
        Args: {
          p_demanda_id: string
          p_id: string
          p_motivo: string
          p_observacoes: string
          p_quantidade: number
          p_tempo_manual_min: number
        }
        Returns: {
          blocos_totais_snapshot: number
          cartao_sessao_id: string | null
          colaborador_id: string
          created_at: string
          data: string
          demanda_id: string
          id: string
          motivo: string | null
          observacoes: string | null
          organizacao_id: string
          quantidade: number
          tempo_manual_min: number | null
          tempo_padrao_snapshot: number | null
        }
        SetofOptions: {
          from: "*"
          to: "apontamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_role: { Args: never; Returns: string }
      avancar_sequencia_cartao: {
        Args: { p_cartao_id: string }
        Returns: {
          cartao_id: string
          colaborador_id: string
          entregue: boolean
          entregue_em: string | null
          id: string
          ordem: number
          organizacao_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cartoes_sequencia_responsaveis"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      definir_admin: {
        Args: { p_admin: boolean; p_colaborador_id: string }
        Returns: undefined
      }
      is_quadro_membro: { Args: { p_quadro_id: string }; Returns: boolean }
      isolamento_status_tabela: {
        Args: { p_tabela: string }
        Returns: {
          organizacao_id_not_null: boolean
          tem_organizacao_id: boolean
          tem_politica_restrictive_org_atual: boolean
        }[]
      }
      org_atual: { Args: never; Returns: string }
      registrar_apontamento: {
        Args: {
          p_demanda_id: string
          p_motivo: string
          p_observacoes: string
          p_quantidade: number
          p_tempo_manual_min: number
        }
        Returns: {
          blocos_totais_snapshot: number
          cartao_sessao_id: string | null
          colaborador_id: string
          created_at: string
          data: string
          demanda_id: string
          id: string
          motivo: string | null
          observacoes: string | null
          organizacao_id: string
          quantidade: number
          tempo_manual_min: number | null
          tempo_padrao_snapshot: number | null
        }
        SetofOptions: {
          from: "*"
          to: "apontamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_apontamento_timer: {
        Args: { p_data: string; p_minutos: number; p_sessao_id: string }
        Returns: {
          blocos_totais_snapshot: number
          cartao_sessao_id: string | null
          colaborador_id: string
          created_at: string
          data: string
          demanda_id: string
          id: string
          motivo: string | null
          observacoes: string | null
          organizacao_id: string
          quantidade: number
          tempo_manual_min: number | null
          tempo_padrao_snapshot: number | null
        }
        SetofOptions: {
          from: "*"
          to: "apontamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rejeitar_cartao: {
        Args: { p_comentario?: string; p_id: string }
        Returns: {
          aprovador_id: string
          atualizado_em: string
          cartao_id: string
          comentario: string | null
          criado_em: string
          id: string
          organizacao_id: string
          solicitado_por: string
          status: Database["public"]["Enums"]["status_aprovacao_cartao"]
        }
        SetofOptions: {
          from: "*"
          to: "cartoes_aprovacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rejeitar_correcao_apontamento: {
        Args: { p_id: string; p_motivo?: string }
        Returns: {
          apontamento_id: string | null
          colaborador_id: string
          criado_em: string
          data: string
          decidido_em: string | null
          decidido_por: string | null
          demanda_id: string
          id: string
          justificativa: string
          motivo: string | null
          observacoes: string | null
          organizacao_id: string
          quantidade: number
          status: Database["public"]["Enums"]["status_solicitacao"]
          tempo_manual_min: number | null
        }
        SetofOptions: {
          from: "*"
          to: "apontamentos_correcoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rejeitar_solicitacao: {
        Args: { p_id: string }
        Returns: {
          area_id: string
          ativo: boolean | null
          atualizado_em: string
          blocos_totais: number
          colaborador_id: string
          criado_em: string
          demanda_id: string | null
          finita: boolean
          id: string
          nome: string
          organizacao_id: string
          status: Database["public"]["Enums"]["status_solicitacao"]
          tempo_padrao_min: number | null
          tipo: Database["public"]["Enums"]["tipo_solicitacao"]
          variavel: boolean
        }
        SetofOptions: {
          from: "*"
          to: "solicitacoes_demandas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      solicitar_aprovacao_cartao: {
        Args: { p_aprovador_id: string; p_cartao_id: string }
        Returns: {
          aprovador_id: string
          atualizado_em: string
          cartao_id: string
          comentario: string | null
          criado_em: string
          id: string
          organizacao_id: string
          solicitado_por: string
          status: Database["public"]["Enums"]["status_aprovacao_cartao"]
        }
        SetofOptions: {
          from: "*"
          to: "cartoes_aprovacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transicionar_organizacoes: {
        Args: never
        Returns: {
          id: string
          status_novo: string
        }[]
      }
    }
    Enums: {
      status_aprovacao_cartao: "PENDENTE" | "APROVADA" | "REJEITADA"
      status_solicitacao: "PENDENTE" | "APROVADA" | "REJEITADA"
      tipo_solicitacao: "NOVA" | "ALTERACAO"
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
      status_aprovacao_cartao: ["PENDENTE", "APROVADA", "REJEITADA"],
      status_solicitacao: ["PENDENTE", "APROVADA", "REJEITADA"],
      tipo_solicitacao: ["NOVA", "ALTERACAO"],
    },
  },
} as const
