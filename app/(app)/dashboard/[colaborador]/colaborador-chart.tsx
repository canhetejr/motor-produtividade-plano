'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

type ChartData = {
  data: string
  indice: number
  esperado: number
}

export function ColaboradorChart({ data }: { data: ChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="data"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}%`}
          domain={[0, 'auto']}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          formatter={(value) => [`${value ?? 0}%`, 'Índice de Produtividade']}
          contentStyle={{
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--popover-foreground)',
          }}
          labelStyle={{ color: 'var(--popover-foreground)' }}
        />
        <Legend />
        <ReferenceLine y={100} label={{ value: 'Meta (100%)', fill: 'var(--muted-foreground)' }} stroke="var(--success)" strokeDasharray="3 3" />
        <Line
          type="monotone"
          name="Produtividade"
          dataKey="indice"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ fill: 'var(--primary)' }}
          activeDot={{ r: 8 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
