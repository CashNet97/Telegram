import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { DollarSign, ShoppingBag, Car, Utensils } from "lucide-react";

const dataPie = [
  { name: "Food & Drink", value: 500, color: "#A259FF" },
  { name: "Shopping", value: 300, color: "#00C49F" },
  { name: "Transport", value: 200, color: "#FFB547" },
];

const dataBar = [
  { name: "Mar", spent: 400 },
  { name: "Apr", spent: 300 },
  { name: "May", spent: 700 },
  { name: "Jun", spent: 500 },
  { name: "Jul", spent: 200 },
  { name: "Aug", spent: 600 },
];

export default function FinanceDashboard() {
  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white p-4 space-y-6">
      {/* Баланс */}
      <Card className="bg-[#1b263b] rounded-2xl shadow-lg border-none">
        <CardContent className="p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-400">Chase Bank</p>
              <h2 className="text-2xl font-bold">$9,459.10</h2>
            </div>
            <DollarSign className="w-10 h-10 text-[#7CFC00]" />
          </div>
        </CardContent>
      </Card>

      {/* Последние транзакции */}
      <Card className="bg-[#1b263b] rounded-2xl shadow-lg border-none">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Utensils className="text-[#A259FF]" />
              <span>Loewy Restaurant</span>
            </div>
            <span className="text-red-400">- $134.90</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-[#00C49F]" />
              <span>Sephora</span>
            </div>
            <span className="text-green-400">+ $50.00</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Car className="text-[#FFB547]" />
              <span>Shell Gas</span>
            </div>
            <span className="text-red-400">- $78.00</span>
          </div>
        </CardContent>
      </Card>

      {/* Круговая диаграмма */}
      <Card className="bg-[#1b263b] rounded-2xl shadow-lg border-none">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Spending Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dataPie}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                label
              >
                {dataPie.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Бюджет */}
      <Card className="bg-[#1b263b] rounded-2xl shadow-lg border-none">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Budget</h3>
          <Progress value={60} className="h-3 bg-gray-700" />
          <p className="mt-2 text-sm text-gray-400">$1,456.80 left of $4,000</p>
        </CardContent>
      </Card>

      {/* Гистограмма */}
      <Card className="bg-[#1b263b] rounded-2xl shadow-lg border-none">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Spending</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dataBar}>
              <XAxis dataKey="name" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Bar dataKey="spent" fill="#A259FF" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Кнопка */}
      <Button className="w-full bg-[#A259FF] hover:bg-[#8a3dff] text-white rounded-2xl py-6 text-lg font-semibold">
        Set Budget
      </Button>
    </div>
  );
}