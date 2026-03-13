import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  generateSharedSecret,
  deriveContactRoomCode,
  getTodayUTC,
  generatePeerId,
} from "@/lib/crypto"

export interface Contact {
  id: string
  name: string
  sharedSecret: string
  createdAt: number
  lastSequence: number
  lastSequenceDate: string
}

interface ContactStore {
  contacts: Contact[]
  addContact: (name: string, sharedSecret: string) => Contact
  removeContact: (id: string) => void
  renameContact: (id: string, newName: string) => void
  getContact: (id: string) => Contact | undefined
  deriveNextRoom: (contactId: string) => { roomCode: string; sequence: number } | null
  createPairing: () => string
}

export const useContactStore = create<ContactStore>()(
  persist(
    (set, get) => ({
      contacts: [],

      addContact: (name: string, sharedSecret: string) => {
        const contact: Contact = {
          id: generatePeerId(),
          name,
          sharedSecret,
          createdAt: Date.now(),
          lastSequence: 0,
          lastSequenceDate: "",
        }
        set((s) => ({ contacts: [...s.contacts, contact] }))
        return contact
      },

      removeContact: (id: string) => {
        set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }))
      },

      renameContact: (id: string, newName: string) => {
        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === id ? { ...c, name: newName } : c
          ),
        }))
      },

      getContact: (id: string) => {
        return get().contacts.find((c) => c.id === id)
      },

      deriveNextRoom: (contactId: string) => {
        const state = get()
        const contact = state.contacts.find((c) => c.id === contactId)
        if (!contact) return null

        const today = getTodayUTC()
        let sequence = contact.lastSequenceDate === today ? contact.lastSequence : 0
        const roomCode = deriveContactRoomCode(contact.sharedSecret, today, sequence)

        set((s) => ({
          contacts: s.contacts.map((c) =>
            c.id === contactId
              ? { ...c, lastSequence: sequence + 1, lastSequenceDate: today }
              : c
          ),
        }))

        return { roomCode, sequence }
      },

      createPairing: () => {
        return generateSharedSecret()
      },
    }),
    {
      name: "true-contacts",
    }
  )
)
