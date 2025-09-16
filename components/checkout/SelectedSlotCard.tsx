"use client"

import React from "react"
import { Clock, Truck } from "lucide-react"

export type SelectedSlotCardProps = {
  pickup?: { date?: string; label?: string } | null
  delivery?: { date?: string; label?: string } | null
  serviceType?: "standard" | "express"
}

function formatDayLabel(dateStr?: string) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (same(d, today)) return "Today"
  if (same(d, tomorrow)) return "Tomorrow"
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SelectedSlotCard({ pickup, delivery, serviceType }: SelectedSlotCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-blue-700 font-semibold text-sm sm:text-base">Selection Summary</h3>
      </div>
      <div className="space-y-2 ml-0">
        <div className="flex items-center gap-2 text-gray-800">
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-sm sm:text-base">Pickup: {formatDayLabel(pickup?.date) || '-'}{pickup?.label ? ` at ${pickup.label}` : ''}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-800">
          <Truck className="w-4 h-4 text-blue-600" />
          <span className="text-sm sm:text-base">Delivery: {formatDayLabel(delivery?.date) || '-'}{delivery?.label ? ` at ${delivery.label}` : ''}</span>
        </div>
        <div className="text-xs text-gray-600">{serviceType === 'express' ? 'Express Delivery' : 'Standard Delivery'}</div>
      </div>
    </div>
  )
}

