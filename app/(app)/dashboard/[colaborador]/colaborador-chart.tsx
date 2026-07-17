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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis 
          dataKey="data" 
          tickLine={false} 
          axisLine={false} 
          tickMargin={10} 
        />
        <YAxis 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(value) => `${value}%`} 
          domain={[0, 'auto']} 
        />
        <Tooltip 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${value}%`, 'Índice de Produtividade']}
          labelStyle={{ color: 'black' }}
        />
        <Legend />
        <ReferenceLine y={100} label="Meta (100%)" stroke="#22c55e" strokeDasharray="3 3" />
        <Line 
          type="monotone" 
          name="Produtividade"
          dataKey="indice" 
          stroke="#3b82f6" 
          strokeWidth={2}
          activeDot={{ r: 8 }} 
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
