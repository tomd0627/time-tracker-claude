import { create } from 'zustand';

type ModalType = 'entry-form' | 'client-form' | 'project-form' | 'tag-form' | 'expense-form' | null;

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  activeModal: ModalType;
  modalPayload: unknown;
  openModal: (modal: ModalType, payload?: unknown) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  activeModal: null,
  modalPayload: null,
  openModal: (modal, payload = null) => set({ activeModal: modal, modalPayload: payload }),
  closeModal: () => set({ activeModal: null, modalPayload: null }),
}));
