'use client';

import React, { useState } from 'react';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  category: string;
}

export default function DigitalMenu({ items, restaurantId }: { items: MenuItem[], restaurantId: string }) {
  const [cart, setCart] = useState<{item: MenuItem, quantity: number}[]>([]);

  const categories = Array.from(new Set(items.map(i => i.category)));

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 bg-white rounded-xl shadow-lg border border-gray-100 relative">
      <h2 className="text-3xl font-black text-gray-900 mb-8 text-center tracking-tight">Our Menu</h2>
      
      {categories.map(category => (
        <div key={category} className="mb-10">
          <h3 className="text-2xl font-bold text-indigo-700 mb-6 border-b-2 border-indigo-100 inline-block pb-1">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.filter(i => i.category === category).map(item => (
              <div key={item.id} className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:shadow-md transition-shadow bg-gray-50">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-24 h-24 object-cover rounded-lg shadow-sm" />
                )}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg leading-tight">{item.name}</h4>
                    {item.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-bold text-lg text-indigo-900">₹{item.price}</span>
                    <button 
                      onClick={() => addToCart(item)}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-bold shadow-sm transition active:scale-95"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {cart.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-gray-900 text-white rounded-2xl p-4 shadow-2xl flex justify-between items-center z-50">
          <div>
            <span className="block text-sm font-semibold opacity-80">{cart.reduce((acc, i) => acc + i.quantity, 0)} items</span>
            <span className="block text-xl font-bold">₹{cart.reduce((acc, i) => acc + (i.item.price * i.quantity), 0)}</span>
          </div>
          <button className="bg-white text-gray-900 px-6 py-2.5 rounded-xl font-bold hover:bg-gray-100 transition shadow-sm">
            Checkout
          </button>
        </div>
      ) : (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md flex justify-center gap-4 z-50">
           <a href={`/${typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : ''}/queue`} className="flex-1 max-w-[160px] text-center bg-[#063124] text-white px-4 py-3 rounded-full font-bold shadow-xl hover:bg-green-900 transition flex items-center justify-center gap-2">
             📋 Join Waitlist
           </a>
           <a href={`/${typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : ''}/queue`} className="flex-1 max-w-[160px] text-center bg-white text-[#063124] border-2 border-[#063124] px-4 py-3 rounded-full font-bold shadow-xl hover:bg-gray-50 transition flex items-center justify-center gap-2">
             🎟️ Check Status
           </a>
        </div>
      )}
    </div>
  );
}
