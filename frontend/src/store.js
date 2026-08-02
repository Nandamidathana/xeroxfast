import { create } from 'zustand'

export const useStore = create((set) => ({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  soundEnabled: true,
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  currentShopId: localStorage.getItem('last_shop_id') || 'quickprint',
  setShopId: (shopId) => {
    localStorage.setItem('last_shop_id', shopId);
    set({ currentShopId: shopId });
  },
  // Customer Identity configuration
  customerName: localStorage.getItem('customer_name') || '',
  setCustomerName: (name) => {
    localStorage.setItem('customer_name', name);
    set({ customerName: name });
  },
  // Dynamic Pricing Configuration (defaults to Indian Rupee based on user location)
  rateBW: parseFloat(localStorage.getItem('rate_bw') || '2.00'),
  rateColor: parseFloat(localStorage.getItem('rate_color') || '10.00'),
  currencySymbol: localStorage.getItem('currency_symbol') || '₹',
  setPricing: (bw, color, symbol) => {
    localStorage.setItem('rate_bw', bw.toString());
    localStorage.setItem('rate_color', color.toString());
    localStorage.setItem('currency_symbol', symbol);
    set({ rateBW: bw, rateColor: color, currencySymbol: symbol });
  }
}))
