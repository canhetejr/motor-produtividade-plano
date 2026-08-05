'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { subDays, format as formatDate, parseISO, startOfWeek, startOfMonth } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  Calendar,
  CheckCircle2,
} from 'lucide-react'

type PresetKey = 'hoje' | 'semana' | 'mes' | 'last7' | 'last30' | 'last90'
type ExportFormat = 'csv' | 'xlsx' | 'pdf'

// Shape devolvido por /api/export?format=json — usado só para montar o PDF no cliente.
type LinhaExport = {
  data: string
  quantidade: number | null
  tempo_total_min: number | null
  motivo: string | null
  observacoes: string | null
  colaboradores: { nome: string } | null
  demandas: { nome: string; areas: { nome: string } | null } | null
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Esta Semana' },
  { key: 'mes', label: 'Este Mês' },
  { key: 'last7', label: 'Últimos 7 dias' },
  { key: 'last30', label: 'Últimos 30 dias' },
  { key: 'last90', label: 'Últimos 90 dias' },
]

const FORMATS: {
  key: ExportFormat
  label: string
  desc: string
  icon: React.ElementType
  ext: string
  color: string
}[] = [
  {
    key: 'xlsx',
    label: 'Excel (.xlsx)',
    desc: 'Planilha formatada com cabeçalho colorido, colunas ajustadas e filtros automáticos.',
    icon: FileSpreadsheet,
    ext: '.xlsx',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'csv',
    label: 'CSV',
    desc: 'Dados brutos separados por vírgula. Compatível com qualquer ferramenta de análise.',
    icon: FileType,
    ext: '.csv',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'pdf',
    label: 'PDF',
    desc: 'Relatório formatado para impressão e apresentação com logotipo e tabela estilizada.',
    icon: FileText,
    ext: '.pdf',
    color: 'text-red-600 dark:text-red-400',
  },
]

// Compute preset ranges without relying on server-only timezone utilities at client init time.
// All date arithmetic is done via date-fns (pure, no Intl) so it's safe on both sides.
function presetRange(key: PresetKey, todayIso: string): { start: string; end: string } {
  const end = todayIso
  const today = parseISO(todayIso)
  switch (key) {
    case 'hoje': return { start: end, end }
    case 'semana': return { start: formatDate(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end }
    case 'mes': return { start: formatDate(startOfMonth(today), 'yyyy-MM-dd'), end }
    case 'last7': return { start: formatDate(subDays(today, 7), 'yyyy-MM-dd'), end }
    case 'last30': return { start: formatDate(subDays(today, 30), 'yyyy-MM-dd'), end }
    case 'last90': return { start: formatDate(subDays(today, 90), 'yyyy-MM-dd'), end }
  }
}

interface RelatoriosFormProps {
  areas: { id: string; nome: string }[]
  /** Date strings computed server-side (YYYY-MM-DD) to avoid hydration mismatch */
  defaultStart: string
  defaultEnd: string
}

export function RelatoriosForm({ areas, defaultStart, defaultEnd }: RelatoriosFormProps) {
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [areaId, setAreaId] = useState('all')
  const [activePreset, setActivePreset] = useState<PresetKey | null>('mes')
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('xlsx')
  const [loading, startTransition] = useTransition()

  function aplicarPreset(key: PresetKey) {
    const { start, end } = presetRange(key, defaultEnd)
    setStartDate(start)
    setEndDate(end)
    setActivePreset(key)
  }

  function handleExport() {
    if (!startDate || !endDate) {
      toast.error('Selecione as datas de início e fim.')
      return
    }
    if (startDate > endDate) {
      toast.error('A data inicial deve ser anterior à final.')
      return
    }

    startTransition(async () => {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      })
      if (areaId !== 'all') params.set('area', areaId)

      if (selectedFormat === 'pdf') {
        params.set('format', 'json')
        try {
          const res = await fetch(`/api/export?${params.toString()}`)
          if (!res.ok) throw new Error('Erro ao buscar dados')
          const { rows } = await res.json()
          await generateClientPDF(rows, startDate, endDate)
          toast.success('Relatório PDF gerado com sucesso!')
        } catch (error) {
          console.error(error)
          toast.error('Falha ao gerar o PDF. Tente novamente.')
        }
      } else {
        params.set('format', selectedFormat)
        window.location.href = `/api/export?${params.toString()}`
        toast.success(`Exportando relatório em ${selectedFormat.toUpperCase()}…`)
      }
    })
  }

  // Gera o PDF no cliente. jsPDF + autoTable entram por import dinamico: sao
  // ~400KB que so fazem sentido pra quem escolhe o formato PDF.
  async function generateClientPDF(rows: LinhaExport[], start: string, end: string) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    const doc = new jsPDF('landscape')
    
    // Header
    doc.setFillColor(19, 11, 51) // --deep-space
    doc.rect(0, 0, doc.internal.pageSize.width, 60, 'F')

    const logoResponse = await fetch('/brand/vertice-wordmark.png')
    if (logoResponse.ok) {
      const logo = new Uint8Array(await logoResponse.arrayBuffer())
      doc.addImage(logo, 'PNG', 14, 10, 59, 12)
    }

    doc.setTextColor(0, 255, 206) // --v-mint
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Relatório analítico de apontamentos · Período: ${start} a ${end}`, 14, 42)

    // Table
    const tableData = rows.map((r) => [
      r.data,
      r.colaboradores?.nome ?? '-',
      r.demandas?.areas?.nome ?? '-',
      r.demandas?.nome ?? '-',
      r.quantidade,
      r.tempo_total_min,
      r.motivo || '-',
      r.observacoes || '-'
    ])

    const totalMin = rows.reduce((acc: number, r) => acc + (r.tempo_total_min || 0), 0)
    const totalH = Math.floor(totalMin / 60)
    const totalM = totalMin % 60

    autoTable(doc, {
      startY: 70,
      head: [['Data', 'Colaborador', 'Área', 'Demanda', 'Qtd', 'Tempo (min)', 'Motivo', 'Observações']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [130, 10, 209], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        4: { halign: 'center' },
        5: { halign: 'center', fontStyle: 'bold', textColor: [5, 150, 105] }, // Emerald for time
      },
      margin: { top: 70, bottom: 30 },
      didDrawPage: function (data) {
        // Footer
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Página ${data.pageNumber} · Total de registros: ${rows.length} · Tempo Total: ${totalH}h ${totalM}min`,
          14,
          doc.internal.pageSize.height - 15
        )
      },
    })

    doc.save(`relatorio-${start}-ate-${end}.pdf`)
  }

  const selectedFmt = FORMATS.find((f) => f.key === selectedFormat)!

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Period */}
      <div className="bg-card border border-border rounded-md p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Período
        </h2>

        <div className="flex flex-wrap gap-2 mb-5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => aplicarPreset(p.key)}
              className={`px-3 py-1.5 text-xs font-medium border transition-all rounded-md ${
                activePreset === p.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start_date" className="text-xs">Data Inicial</Label>
            <Input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePreset(null) }}
              className="rounded-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end_date" className="text-xs">Data Final</Label>
            <Input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActivePreset(null) }}
              className="rounded-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Área</Label>
            <Select value={areaId} onValueChange={(v) => setAreaId(v ?? 'all')}>
              <SelectTrigger className="rounded-sm">
                <SelectValue placeholder="Todas as áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Format Selection */}
      <div className="bg-card border border-border rounded-md p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Download className="h-4 w-4" />
          Formato de Exportação
        </h2>

        <div className="flex flex-col gap-3">
          {FORMATS.map((fmt) => {
            const Icon = fmt.icon
            const isSelected = selectedFormat === fmt.key
            return (
              <button
                key={fmt.key}
                type="button"
                onClick={() => setSelectedFormat(fmt.key)}
                className={`relative text-left p-4 border rounded-md transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                {isSelected && (
                  <CheckCircle2 className="absolute top-4 right-4 h-5 w-5 text-primary" />
                )}
                <div className="flex items-start gap-4">
                  <Icon className={`h-8 w-8 shrink-0 ${fmt.color}`} />
                  <div>
                    <div className="font-semibold text-sm text-foreground mb-1">{fmt.label}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{fmt.desc}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Export Button */}
      <Button
        id="btn-exportar"
        type="button"
        size="lg"
        onClick={handleExport}
        disabled={loading || !startDate || !endDate}
        className="w-full rounded-md text-base font-semibold h-12"
      >
        {loading ? (
          <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Gerando relatório…</>
        ) : (
          <>
            <selectedFmt.icon className="h-5 w-5 mr-2" />
            Exportar Relatório {selectedFmt.ext.toUpperCase()}
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        O arquivo será gerado com os dados de <strong>{startDate || '—'}</strong> a <strong>{endDate || '—'}</strong>
        {areaId !== 'all' && <span> · área filtrada</span>}
      </p>
    </div>
  )
}
