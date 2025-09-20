'use client';

import React from "react"
import { CreditCard, Banknote } from "lucide-react"

export type PaymentMethodsProps = {
  total: number
  selectedMethod: "online" | "cod"
  onSelect: (m: "online" | "cod") => void
}

function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n)
  } catch {
    return `₹${n.toFixed(2)}`
  }
}

export default function PaymentMethods({ total, selectedMethod, onSelect }: PaymentMethodsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Payment Method</h3>
        <span className="text-xs text-blue-600 font-medium">Total: {formatINR(total)}</span>
      </div>
      <div className="space-y-3">
        <label className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${selectedMethod==='online' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-gray-200 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <input type="radio" className="sr-only" checked={selectedMethod==='online'} onChange={() => onSelect('online')} />
            <div className={`p-2 rounded-full ${selectedMethod==='online' ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <CreditCard className={`w-5 h-5 ${selectedMethod==='online' ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className={`font-medium ${selectedMethod==='online' ? 'text-blue-900' : 'text-gray-900'}`}>Pay Online</p>
              <p className={`text-xs ${selectedMethod==='online' ? 'text-blue-700' : 'text-gray-600'}`}>UPI, Card, Net Banking, Wallet</p>
            </div>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">RECOMMENDED</span>
        </label>

        <label onClick={() => onSelect('cod')} className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${selectedMethod==='cod' ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-gray-200 hover:bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <input type="radio" className="sr-only" checked={selectedMethod==='cod'} onChange={() => onSelect('cod')} />
            <div className={`p-2 rounded-full ${selectedMethod==='cod' ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Banknote className={`w-5 h-5 ${selectedMethod==='cod' ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className={`font-medium ${selectedMethod==='cod' ? 'text-blue-900' : 'text-gray-900'}`}>Pay on Delivery</p>
              <p className={`text-xs ${selectedMethod==='cod' ? 'text-blue-700' : 'text-gray-600'}`}>Cash payment when order is delivered</p>
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}

