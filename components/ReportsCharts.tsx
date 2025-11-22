import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line } from 'recharts';

export const SalesChart = ({ data }: { data: any[] }) => (
  <div className="h-80 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value) => `R$ ${value}`} />
        <Legend />
        <Bar dataKey="total" fill="#2563eb" name="Vendas (R$)" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const ProductStockChart = ({ data }: { data: any[] }) => (
  <div className="h-80 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis dataKey="name" type="category" width={100} />
        <Tooltip />
        <Legend />
        <Bar dataKey="stock" fill="#10b981" name="Estoque Atual" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const GoalsComparisonChart = ({ data }: { data: any[] }) => (
  <div className="h-80 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`} />
        <Legend />
        <Bar dataKey="retailActual" name="Venda Varejo" fill="#3b82f6" stackId="a" />
        <Bar dataKey="wholesaleActual" name="Venda Atacado" fill="#8b5cf6" stackId="a" />
        <Line type="monotone" dataKey="retailTarget" name="Meta Varejo" stroke="#1d4ed8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="wholesaleTarget" name="Meta Atacado" stroke="#7c3aed" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);