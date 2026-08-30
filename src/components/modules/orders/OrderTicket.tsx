import React from 'react';
import OrderTypeBadge from './OrderTypeBadge';
import { OrderType } from '@/types';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderTicketProps {
  order: {
    id: string;
    ticket_number: number;
    total_price: number;
    is_paid: boolean;
    table_number?: string;
    order_type?: OrderType | string;
    status: string;
    items: OrderItem[];
    user_name?: string;
  };
  onUpdateStatus?: (id: string, newStatus: string) => void;
}

export default function OrderTicket({ order, onUpdateStatus }: OrderTicketProps) {
  const statusColors: Record<string, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'PREPARING': 'bg-blue-100 text-blue-800 border-blue-200',
    'READY': 'bg-green-100 text-green-800 border-green-200',
    'SERVED': 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const colorClass = statusColors[order.status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <div className={`border rounded-xl p-5 shadow-sm transition-all ${colorClass}`}>
      <div className="flex justify-between items-start mb-4 border-b border-black/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black">#{order.ticket_number}</h3>
            <OrderTypeBadge type={order.order_type} />
          </div>
          <p className="text-sm font-semibold opacity-80 mt-0.5">{order.user_name || 'Guest'}</p>
          {order.table_number && (
            <p className="text-xs font-bold mt-1 bg-black/5 inline-block px-2 py-0.5 rounded">
              Table: {order.table_number}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="text-lg font-bold">₹{order.total_price}</span>
          <div className="text-xs font-semibold mt-1 opacity-70">
            {order.is_paid ? 'PAID' : 'UNPAID'}
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-5">
        {order.items?.map((item, idx) => (
          <div key={idx} className="flex justify-between text-sm font-medium">
            <span>{item.quantity}x {item.name}</span>
            <span className="opacity-80">₹{item.price * item.quantity}</span>
          </div>
        ))}
      </div>

      {onUpdateStatus && (
        <div className="flex gap-2">
          {order.status === 'PENDING' && (
            <button onClick={() => onUpdateStatus(order.id, 'PREPARING')} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded shadow hover:bg-blue-700 transition">
              Prepare
            </button>
          )}
          {order.status === 'PREPARING' && (
            <button onClick={() => onUpdateStatus(order.id, 'READY')} className="flex-1 bg-green-600 text-white font-bold py-2 rounded shadow hover:bg-green-700 transition">
              Ready
            </button>
          )}
          {order.status === 'READY' && (
            <button onClick={() => onUpdateStatus(order.id, 'SERVED')} className="flex-1 bg-gray-800 text-white font-bold py-2 rounded shadow hover:bg-gray-900 transition">
              Serve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
