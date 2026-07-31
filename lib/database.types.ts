// Tipos do banco escritos à mão no formato do codegen do supabase-js v2.
// Refletem o estado pós-migration 0002 (supabase/migrations/).
// Se o schema mudar, atualize este arquivo junto com a migration.

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

export type Database = {
  public: {
    Tables: {
      areas: {
        Row: { id: string; nome: string; ativo: boolean }
        Insert: { id?: string; nome: string; ativo?: boolean }
        Update: { id?: string; nome?: string; ativo?: boolean }
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
          finita: boolean
        }
        Insert: {
          id?: string
          area_id: string
          nome: string
          tempo_padrao_min?: number | null
          variavel?: boolean
          ativo?: boolean
          blocos_totais?: number
          finita?: boolean
        }
        Update: {
          id?: string
          area_id?: string
          nome?: string
          tempo_padrao_min?: number | null
          variavel?: boolean
          ativo?: boolean
          blocos_totais?: number
          finita?: boolean
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
          // Admin global (bloco 33). Coluna aditiva em vez de role = 'admin'
          // porque 33 policies testam `auth_role() = 'gestor'` — um role novo
          // tiraria acesso em vez de somar. Constraint no banco garante que
          // admin só existe sobre role = 'gestor'.
          admin: boolean
          ativo: boolean
          avatar_url: string | null
          notif_lembrete_diario: boolean
          notif_solicitacoes: boolean
          notif_alerta_queda: boolean
          notif_relatorio_semanal: boolean
        }
        Insert: {
          id: string
          nome: string
          area_id?: string | null
          carga_horaria_min?: number
          role?: Role
          admin?: boolean
          ativo?: boolean
          avatar_url?: string | null
          notif_lembrete_diario?: boolean
          notif_solicitacoes?: boolean
          notif_alerta_queda?: boolean
          notif_relatorio_semanal?: boolean
        }
        Update: {
          id?: string
          nome?: string
          area_id?: string | null
          carga_horaria_min?: number
          role?: Role
          // Escrever aqui direto é bloqueado pelo trigger
          // trg_colaboradores_proteger_admin para quem não é admin — use a
          // RPC definir_admin, que é onde a checagem mora.
          admin?: boolean
          ativo?: boolean
          avatar_url?: string | null
          notif_lembrete_diario?: boolean
          notif_solicitacoes?: boolean
          notif_alerta_queda?: boolean
          notif_relatorio_semanal?: boolean
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
          motivo: string | null
          observacoes: string | null
          created_at: string
          tempo_padrao_snapshot: number | null
          blocos_totais_snapshot: number
          cartao_sessao_id: string | null
        }
        Insert: {
          id?: string
          colaborador_id: string
          demanda_id: string
          data?: string
          quantidade?: number
          tempo_manual_min?: number | null
          motivo?: string | null
          observacoes?: string | null
          created_at?: string
          tempo_padrao_snapshot?: number | null
          blocos_totais_snapshot?: number
          cartao_sessao_id?: string | null
        }
        Update: {
          id?: string
          colaborador_id?: string
          demanda_id?: string
          data?: string
          quantidade?: number
          tempo_manual_min?: number | null
          motivo?: string | null
          observacoes?: string | null
          created_at?: string
          tempo_padrao_snapshot?: number | null
          blocos_totais_snapshot?: number
          cartao_sessao_id?: string | null
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
          finita: boolean
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
          finita?: boolean
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
          finita?: boolean
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
      cron_execucoes: {
        Row: { id: string; tipo: string; chave: string; executado_em: string }
        Insert: { id?: string; tipo: string; chave: string; executado_em?: string }
        Update: { id?: string; tipo?: string; chave?: string; executado_em?: string }
        Relationships: []
      }
      auditoria: {
        Row: {
          id: string
          ator_id: string
          acao: string
          entidade: string
          entidade_id: string | null
          dados_antes: unknown | null
          dados_depois: unknown | null
          criado_em: string
        }
        Insert: {
          id?: string
          ator_id: string
          acao: string
          entidade: string
          entidade_id?: string | null
          dados_antes?: unknown | null
          dados_depois?: unknown | null
          criado_em?: string
        }
        Update: {
          id?: string
          ator_id?: string
          acao?: string
          entidade?: string
          entidade_id?: string | null
          dados_antes?: unknown | null
          dados_depois?: unknown | null
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: 'auditoria_ator_id_fkey'
            columns: ['ator_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
        ]
      }
      quadros: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          codigo: string
          cartao_contador: number
          criado_por: string
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          codigo: string
          cartao_contador?: number
          criado_por: string
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
          codigo?: string
          cartao_contador?: number
          criado_por?: string
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'quadros_criado_por_fkey'
            columns: ['criado_por']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
        ]
      }
      quadros_membros: {
        Row: { quadro_id: string; colaborador_id: string; adicionado_em: string }
        Insert: { quadro_id: string; colaborador_id: string; adicionado_em?: string }
        Update: { quadro_id?: string; colaborador_id?: string; adicionado_em?: string }
        Relationships: [
          {
            foreignKeyName: 'quadros_membros_quadro_id_fkey'
            columns: ['quadro_id']
            isOneToOne: false
            referencedRelation: 'quadros'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'quadros_membros_colaborador_id_fkey'
            columns: ['colaborador_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
        ]
      }
      colunas: {
        Row: { id: string; quadro_id: string; nome: string; posicao: number; created_at: string; etapa_final: boolean; limite_wip: number | null; sla_horas: number | null }
        Insert: { id?: string; quadro_id: string; nome: string; posicao: number; created_at?: string; etapa_final?: boolean; limite_wip?: number | null; sla_horas?: number | null }
        Update: { id?: string; quadro_id?: string; nome?: string; posicao?: number; created_at?: string; etapa_final?: boolean; limite_wip?: number | null; sla_horas?: number | null }
        Relationships: [
          {
            foreignKeyName: 'colunas_quadro_id_fkey'
            columns: ['quadro_id']
            isOneToOne: false
            referencedRelation: 'quadros'
            referencedColumns: ['id']
          },
        ]
      }
      cartoes: {
        Row: {
          id: string
          coluna_id: string
          titulo: string
          descricao: string | null
          posicao: number
          prioridade: PrioridadeCartao
          prazo: string | null
          codigo: string
          criado_por: string | null
          created_at: string
          updated_at: string
          tipo: TipoCartao
          cartao_pai_id: string | null
          inicio_desejado: string | null
          entregue_em: string | null
          recorrencia: unknown | null
          tempo_estimado_min: number | null
          centro_id: string | null
          tag_referencia: string | null
          proxima_recorrencia_em: string | null
          etapa_desde: string | null
          demanda_id: string | null
        }
        Insert: {
          id?: string
          coluna_id: string
          titulo: string
          descricao?: string | null
          posicao: number
          prioridade?: PrioridadeCartao
          prazo?: string | null
          codigo?: string
          criado_por?: string | null
          created_at?: string
          updated_at?: string
          tipo?: TipoCartao
          cartao_pai_id?: string | null
          inicio_desejado?: string | null
          entregue_em?: string | null
          recorrencia?: unknown | null
          tempo_estimado_min?: number | null
          centro_id?: string | null
          tag_referencia?: string | null
          proxima_recorrencia_em?: string | null
          etapa_desde?: string | null
          demanda_id?: string | null
        }
        Update: {
          id?: string
          coluna_id?: string
          titulo?: string
          descricao?: string | null
          posicao?: number
          prioridade?: PrioridadeCartao
          prazo?: string | null
          codigo?: string
          criado_por?: string | null
          created_at?: string
          updated_at?: string
          tipo?: TipoCartao
          cartao_pai_id?: string | null
          inicio_desejado?: string | null
          entregue_em?: string | null
          recorrencia?: unknown | null
          tempo_estimado_min?: number | null
          centro_id?: string | null
          tag_referencia?: string | null
          proxima_recorrencia_em?: string | null
          etapa_desde?: string | null
          demanda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'cartoes_coluna_id_fkey'
            columns: ['coluna_id']
            isOneToOne: false
            referencedRelation: 'colunas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cartoes_cartao_pai_id_fkey'
            columns: ['cartao_pai_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cartoes_centro_id_fkey'
            columns: ['centro_id']
            isOneToOne: false
            referencedRelation: 'areas'
            referencedColumns: ['id']
          },
        ]
      }
      cartoes_responsaveis: {
        Row: { cartao_id: string; colaborador_id: string }
        Insert: { cartao_id: string; colaborador_id: string }
        Update: { cartao_id?: string; colaborador_id?: string }
        Relationships: [
          {
            foreignKeyName: 'cartoes_responsaveis_cartao_id_fkey'
            columns: ['cartao_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cartoes_responsaveis_colaborador_id_fkey'
            columns: ['colaborador_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
        ]
      }
      etiquetas: {
        Row: { id: string; quadro_id: string; nome: string; cor: string; created_at: string }
        Insert: { id?: string; quadro_id: string; nome: string; cor?: string; created_at?: string }
        Update: { id?: string; quadro_id?: string; nome?: string; cor?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: 'etiquetas_quadro_id_fkey'
            columns: ['quadro_id']
            isOneToOne: false
            referencedRelation: 'quadros'
            referencedColumns: ['id']
          },
        ]
      }
      cartoes_etiquetas: {
        Row: { cartao_id: string; etiqueta_id: string }
        Insert: { cartao_id: string; etiqueta_id: string }
        Update: { cartao_id?: string; etiqueta_id?: string }
        Relationships: [
          {
            foreignKeyName: 'cartoes_etiquetas_cartao_id_fkey'
            columns: ['cartao_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cartoes_etiquetas_etiqueta_id_fkey'
            columns: ['etiqueta_id']
            isOneToOne: false
            referencedRelation: 'etiquetas'
            referencedColumns: ['id']
          },
        ]
      }
      comentarios_cartao: {
        Row: {
          id: string
          cartao_id: string
          colaborador_id: string
          conteudo: string
          created_at: string
          tipo: TipoComentarioCartao
        }
        Insert: {
          id?: string
          cartao_id: string
          colaborador_id: string
          conteudo: string
          created_at?: string
          tipo?: TipoComentarioCartao
        }
        Update: {
          id?: string
          cartao_id?: string
          colaborador_id?: string
          conteudo?: string
          created_at?: string
          tipo?: TipoComentarioCartao
        }
        Relationships: [
          {
            foreignKeyName: 'comentarios_cartao_cartao_id_fkey'
            columns: ['cartao_id']
            isOneToOne: false
            referencedRelation: 'cartoes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comentarios_cartao_colaborador_id_fkey'
            columns: ['colaborador_id']
            isOneToOne: false
            referencedRelation: 'colaboradores'
            referencedColumns: ['id']
          },
        ]
      }
      formularios: {
        Row: {
          id: string
          quadro_id: string
          coluna_id: string
          titulo: string
          descricao: string | null
          slug: string
          ativo: boolean
          cor_tema: string
          mensagem_sucesso: string
          mostrar_marca: boolean
          criado_por: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          quadro_id: string
          coluna_id: string
          titulo: string
          descricao?: string | null
          slug: string
          ativo?: boolean
          cor_tema?: string
          mensagem_sucesso?: string
          mostrar_marca?: boolean
          criado_por: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          quadro_id?: string
          coluna_id?: string
          titulo?: string
          descricao?: string | null
          slug?: string
          ativo?: boolean
          cor_tema?: string
          mensagem_sucesso?: string
          mostrar_marca?: boolean
          criado_por?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'formularios_quadro_id_fkey'
            columns: ['quadro_id']
            isOneToOne: false
            referencedRelation: 'quadros'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'formularios_coluna_id_fkey'
            columns: ['coluna_id']
            isOneToOne: false
            referencedRelation: 'colunas'
            referencedColumns: ['id']
          },
        ]
      }
      formularios_campos: {
        Row: {
          id: string
          formulario_id: string
          rotulo: string
          tipo: TipoCampoFormulario
          placeholder: string | null
          obrigatorio: boolean
          posicao: number
          opcoes: string[]
          mapeado_para: MapeamentoCampoFormulario
          created_at: string
        }
        Insert: {
          id?: string
          formulario_id: string
          rotulo: string
          tipo: TipoCampoFormulario
          placeholder?: string | null
          obrigatorio?: boolean
          posicao: number
          opcoes?: string[]
          mapeado_para?: MapeamentoCampoFormulario
          created_at?: string
        }
        Update: {
          id?: string
          formulario_id?: string
          rotulo?: string
          tipo?: TipoCampoFormulario
          placeholder?: string | null
          obrigatorio?: boolean
          posicao?: number
          opcoes?: string[]
          mapeado_para?: MapeamentoCampoFormulario
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'formularios_campos_formulario_id_fkey'
            columns: ['formulario_id']
            isOneToOne: false
            referencedRelation: 'formularios'
            referencedColumns: ['id']
          },
        ]
      }
      cartoes_seguidores: {
        Row: { cartao_id: string; colaborador_id: string; criado_em: string }
        Insert: { cartao_id: string; colaborador_id: string; criado_em?: string }
        Update: { cartao_id?: string; colaborador_id?: string; criado_em?: string }
        Relationships: [
          { foreignKeyName: 'cartoes_seguidores_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_seguidores_colaborador_id_fkey'; columns: ['colaborador_id']; isOneToOne: false; referencedRelation: 'colaboradores'; referencedColumns: ['id'] },
        ]
      }
      cartoes_checklist_itens: {
        Row: { id: string; cartao_id: string; texto: string; concluido: boolean; posicao: number; created_at: string }
        Insert: { id?: string; cartao_id: string; texto: string; concluido?: boolean; posicao?: number; created_at?: string }
        Update: { id?: string; cartao_id?: string; texto?: string; concluido?: boolean; posicao?: number; created_at?: string }
        Relationships: [
          { foreignKeyName: 'cartoes_checklist_itens_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
        ]
      }
      colunas_requisitos: {
        Row: { id: string; coluna_id: string; descricao: string; obrigatorio: boolean; posicao: number; created_at: string }
        Insert: { id?: string; coluna_id: string; descricao: string; obrigatorio?: boolean; posicao?: number; created_at?: string }
        Update: { id?: string; coluna_id?: string; descricao?: string; obrigatorio?: boolean; posicao?: number; created_at?: string }
        Relationships: [
          { foreignKeyName: 'colunas_requisitos_coluna_id_fkey'; columns: ['coluna_id']; isOneToOne: false; referencedRelation: 'colunas'; referencedColumns: ['id'] },
        ]
      }
      cartoes_requisitos_status: {
        Row: { cartao_id: string; requisito_id: string; concluido: boolean; concluido_em: string | null }
        Insert: { cartao_id: string; requisito_id: string; concluido?: boolean; concluido_em?: string | null }
        Update: { cartao_id?: string; requisito_id?: string; concluido?: boolean; concluido_em?: string | null }
        Relationships: [
          { foreignKeyName: 'cartoes_requisitos_status_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_requisitos_status_requisito_id_fkey'; columns: ['requisito_id']; isOneToOne: false; referencedRelation: 'colunas_requisitos'; referencedColumns: ['id'] },
        ]
      }
      cartoes_predecessores: {
        Row: { cartao_id: string; predecessor_id: string; criado_em: string }
        Insert: { cartao_id: string; predecessor_id: string; criado_em?: string }
        Update: { cartao_id?: string; predecessor_id?: string; criado_em?: string }
        Relationships: [
          { foreignKeyName: 'cartoes_predecessores_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_predecessores_predecessor_id_fkey'; columns: ['predecessor_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
        ]
      }
      cartoes_sequencia_responsaveis: {
        Row: { id: string; cartao_id: string; colaborador_id: string; ordem: number; entregue: boolean; entregue_em: string | null }
        Insert: { id?: string; cartao_id: string; colaborador_id: string; ordem: number; entregue?: boolean; entregue_em?: string | null }
        Update: { id?: string; cartao_id?: string; colaborador_id?: string; ordem?: number; entregue?: boolean; entregue_em?: string | null }
        Relationships: [
          { foreignKeyName: 'cartoes_sequencia_responsaveis_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_sequencia_responsaveis_colaborador_id_fkey'; columns: ['colaborador_id']; isOneToOne: false; referencedRelation: 'colaboradores'; referencedColumns: ['id'] },
        ]
      }
      cartoes_anexos: {
        Row: {
          id: string
          cartao_id: string
          colaborador_id: string
          nome_arquivo: string
          caminho_storage: string
          tamanho_bytes: number
          tipo_mime: string
          created_at: string
        }
        Insert: {
          id?: string
          cartao_id: string
          colaborador_id: string
          nome_arquivo: string
          caminho_storage: string
          tamanho_bytes: number
          tipo_mime: string
          created_at?: string
        }
        Update: {
          id?: string
          cartao_id?: string
          colaborador_id?: string
          nome_arquivo?: string
          caminho_storage?: string
          tamanho_bytes?: number
          tipo_mime?: string
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'cartoes_anexos_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_anexos_colaborador_id_fkey'; columns: ['colaborador_id']; isOneToOne: false; referencedRelation: 'colaboradores'; referencedColumns: ['id'] },
        ]
      }
      cartoes_aprovacoes: {
        Row: {
          id: string
          cartao_id: string
          solicitado_por: string
          aprovador_id: string
          status: StatusAprovacaoCartao
          comentario: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          cartao_id: string
          solicitado_por: string
          aprovador_id: string
          status?: StatusAprovacaoCartao
          comentario?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          cartao_id?: string
          solicitado_por?: string
          aprovador_id?: string
          status?: StatusAprovacaoCartao
          comentario?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          { foreignKeyName: 'cartoes_aprovacoes_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_aprovacoes_solicitado_por_fkey'; columns: ['solicitado_por']; isOneToOne: false; referencedRelation: 'colaboradores'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_aprovacoes_aprovador_id_fkey'; columns: ['aprovador_id']; isOneToOne: false; referencedRelation: 'colaboradores'; referencedColumns: ['id'] },
        ]
      }
      cartoes_emails: {
        Row: { id: string; cartao_id: string; colaborador_id: string; destinatario: string; assunto: string; corpo: string; enviado_em: string }
        Insert: { id?: string; cartao_id: string; colaborador_id: string; destinatario: string; assunto: string; corpo: string; enviado_em?: string }
        Update: { id?: string; cartao_id?: string; colaborador_id?: string; destinatario?: string; assunto?: string; corpo?: string; enviado_em?: string }
        Relationships: [
          { foreignKeyName: 'cartoes_emails_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
        ]
      }
      cartoes_sessoes_tempo: {
        Row: { id: string; cartao_id: string; colaborador_id: string; iniciado_em: string; finalizado_em: string | null; minutos: number | null }
        Insert: { id?: string; cartao_id: string; colaborador_id: string; iniciado_em?: string; finalizado_em?: string | null; minutos?: number | null }
        Update: { id?: string; cartao_id?: string; colaborador_id?: string; iniciado_em?: string; finalizado_em?: string | null; minutos?: number | null }
        Relationships: [
          { foreignKeyName: 'cartoes_sessoes_tempo_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_sessoes_tempo_colaborador_id_fkey'; columns: ['colaborador_id']; isOneToOne: false; referencedRelation: 'colaboradores'; referencedColumns: ['id'] },
        ]
      }
      quadros_campos: {
        Row: { id: string; quadro_id: string; nome: string; tipo: TipoCampoCustomizado; opcoes: string[]; obrigatorio: boolean; posicao: number; created_at: string }
        Insert: { id?: string; quadro_id: string; nome: string; tipo: TipoCampoCustomizado; opcoes?: string[]; obrigatorio?: boolean; posicao?: number; created_at?: string }
        Update: { id?: string; quadro_id?: string; nome?: string; tipo?: TipoCampoCustomizado; opcoes?: string[]; obrigatorio?: boolean; posicao?: number; created_at?: string }
        Relationships: [
          { foreignKeyName: 'quadros_campos_quadro_id_fkey'; columns: ['quadro_id']; isOneToOne: false; referencedRelation: 'quadros'; referencedColumns: ['id'] },
        ]
      }
      cartoes_campos_valores: {
        Row: { cartao_id: string; campo_id: string; valor: unknown | null; atualizado_em: string }
        Insert: { cartao_id: string; campo_id: string; valor?: unknown | null; atualizado_em?: string }
        Update: { cartao_id?: string; campo_id?: string; valor?: unknown | null; atualizado_em?: string }
        Relationships: [
          { foreignKeyName: 'cartoes_campos_valores_cartao_id_fkey'; columns: ['cartao_id']; isOneToOne: false; referencedRelation: 'cartoes'; referencedColumns: ['id'] },
          { foreignKeyName: 'cartoes_campos_valores_campo_id_fkey'; columns: ['campo_id']; isOneToOne: false; referencedRelation: 'quadros_campos'; referencedColumns: ['id'] },
        ]
      }
      automacoes: {
        Row: { id: string; quadro_id: string; nome: string; ativa: boolean; posicao: number; evento: string; evento_config: unknown; criado_por: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; quadro_id: string; nome: string; ativa?: boolean; posicao?: number; evento: string; evento_config?: unknown; criado_por?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; quadro_id?: string; nome?: string; ativa?: boolean; posicao?: number; evento?: string; evento_config?: unknown; criado_por?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: 'automacoes_quadro_id_fkey'; columns: ['quadro_id']; isOneToOne: false; referencedRelation: 'quadros'; referencedColumns: ['id'] },
        ]
      }
      automacoes_acoes: {
        Row: { id: string; automacao_id: string; ordem: number; tipo: string; config: unknown }
        Insert: { id?: string; automacao_id: string; ordem: number; tipo: string; config?: unknown }
        Update: { id?: string; automacao_id?: string; ordem?: number; tipo?: string; config?: unknown }
        Relationships: [
          { foreignKeyName: 'automacoes_acoes_automacao_id_fkey'; columns: ['automacao_id']; isOneToOne: false; referencedRelation: 'automacoes'; referencedColumns: ['id'] },
        ]
      }
      automacoes_execucoes: {
        Row: { id: string; automacao_id: string; cartao_id: string | null; status: StatusExecucaoAutomacao; erro: string | null; acoes_executadas: number; executado_em: string }
        Insert: { id?: string; automacao_id: string; cartao_id?: string | null; status: StatusExecucaoAutomacao; erro?: string | null; acoes_executadas?: number; executado_em?: string }
        Update: { id?: string; automacao_id?: string; cartao_id?: string | null; status?: StatusExecucaoAutomacao; erro?: string | null; acoes_executadas?: number; executado_em?: string }
        Relationships: [
          { foreignKeyName: 'automacoes_execucoes_automacao_id_fkey'; columns: ['automacao_id']; isOneToOne: false; referencedRelation: 'automacoes'; referencedColumns: ['id'] },
        ]
      }
    }
    Views: {
      demandas_acumulado: {
        Row: { demanda_id: string; acumulado: number }
        Relationships: [
          {
            foreignKeyName: 'apontamentos_demanda_id_fkey'
            columns: ['demanda_id']
            isOneToOne: false
            referencedRelation: 'demandas'
            referencedColumns: ['id']
          },
        ]
      }
      apontamentos_calculado: {
        Row: {
          id: string
          colaborador_id: string
          demanda_id: string
          data: string
          quantidade: number
          tempo_manual_min: number | null
          motivo: string | null
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
      is_quadro_membro: { Args: { p_quadro_id: string }; Returns: boolean }
      // Único caminho de escrita em apontamentos desde 20260722020000 — o
      // INSERT direto foi revogado de `authenticated` (registra e valida
      // motivo/teto de blocos/tempo manual/demanda ativa no próprio banco).
      registrar_apontamento: {
        Args: {
          p_demanda_id: string
          p_quantidade: number
          p_tempo_manual_min: number | null
          p_motivo: string | null
          p_observacoes: string | null
        }
        Returns: {
          id: string
          colaborador_id: string
          demanda_id: string
          data: string
          quantidade: number
          tempo_manual_min: number | null
          motivo: string | null
          observacoes: string | null
          created_at: string
          tempo_padrao_snapshot: number | null
          blocos_totais_snapshot: number
        }
      }
      // Concede/revoga admin global (bloco 33). SECURITY DEFINER com a
      // checagem `auth_is_admin()` dentro, então não há caminho de código que
      // esqueça de checar. Levanta APENAS_ADMIN, PRECISA_SER_GESTOR,
      // COLABORADOR_INEXISTENTE ou ULTIMO_ADMIN.
      definir_admin: {
        Args: {
          p_colaborador_id: string
          p_admin: boolean
        }
        Returns: undefined
      }
      // Sessão de cronômetro do Kanban virando apontamento (bloco 32).
      // Diferente de registrar_apontamento, aceita `p_data`: sessão de timer
      // tem timestamps reais, então lança no dia em que o trabalho aconteceu.
      // Devolve null quando o card não tem demanda ou a sessão já foi lançada.
      registrar_apontamento_timer: {
        Args: {
          p_sessao_id: string
          p_data: string
          p_minutos: number
        }
        Returns: {
          id: string
          colaborador_id: string
          demanda_id: string
          data: string
          quantidade: number
          tempo_manual_min: number | null
          motivo: string | null
          observacoes: string | null
          created_at: string
          tempo_padrao_snapshot: number | null
          blocos_totais_snapshot: number
        } | null
      }
      // Único caminho de edição em apontamentos desde 20260722050000 — o
      // UPDATE direto foi revogado de `authenticated`, mesmo raciocínio da
      // registrar_apontamento acima.
      atualizar_apontamento: {
        Args: {
          p_id: string
          p_demanda_id: string
          p_quantidade: number
          p_tempo_manual_min: number | null
          p_motivo: string | null
          p_observacoes: string | null
        }
        Returns: {
          id: string
          colaborador_id: string
          demanda_id: string
          data: string
          quantidade: number
          tempo_manual_min: number | null
          motivo: string | null
          observacoes: string | null
          created_at: string
          tempo_padrao_snapshot: number | null
          blocos_totais_snapshot: number
        }
      }
      // Únicos caminhos de aprovação/rejeição desde 20260722030000 — movem
      // claim + validação + insert/update em demandas + notificação pra uma
      // única transação (RAISE EXCEPTION desfaz tudo da mesma invocação).
      aprovar_solicitacao: {
        Args: { p_id: string }
        Returns: {
          id: string
          colaborador_id: string
          area_id: string
          demanda_id: string | null
          tipo: string
          nome: string
          tempo_padrao_min: number | null
          variavel: boolean
          blocos_totais: number
          finita: boolean
          ativo: boolean | null
          status: string
          criado_em: string
          atualizado_em: string
        }
      }
      rejeitar_solicitacao: {
        Args: { p_id: string }
        Returns: {
          id: string
          colaborador_id: string
          area_id: string
          demanda_id: string | null
          tipo: string
          nome: string
          tempo_padrao_min: number | null
          variavel: boolean
          blocos_totais: number
          finita: boolean
          ativo: boolean | null
          status: string
          criado_em: string
          atualizado_em: string
        }
      }
      // Avança a fila de responsáveis de um card (seção "Regras") — marca o
      // atual como entregue e notifica o próximo; retorna null se a fila
      // acabou (ver 20260729130000_kanban_regras_dependencias.sql).
      avancar_sequencia_cartao: {
        Args: { p_cartao_id: string }
        Returns: {
          id: string
          cartao_id: string
          colaborador_id: string
          ordem: number
          entregue: boolean
          entregue_em: string | null
        } | null
      }
      solicitar_aprovacao_cartao: {
        Args: { p_cartao_id: string; p_aprovador_id: string }
        Returns: {
          id: string
          cartao_id: string
          solicitado_por: string
          aprovador_id: string
          status: string
          comentario: string | null
          criado_em: string
          atualizado_em: string
        }
      }
      aprovar_cartao: {
        Args: { p_id: string }
        Returns: {
          id: string
          cartao_id: string
          solicitado_por: string
          aprovador_id: string
          status: string
          comentario: string | null
          criado_em: string
          atualizado_em: string
        }
      }
      rejeitar_cartao: {
        Args: { p_id: string; p_comentario?: string | null }
        Returns: {
          id: string
          cartao_id: string
          solicitado_por: string
          aprovador_id: string
          status: string
          comentario: string | null
          criado_em: string
          atualizado_em: string
        }
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
