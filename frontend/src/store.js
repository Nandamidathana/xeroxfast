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
  }
}))
