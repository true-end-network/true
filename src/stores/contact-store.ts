import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  generateSharedSecret,
  deriveContactRoomCode,
  deriveGroupRoomCode,
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

export interface ContactGroup {
  id: string
  name: string
  contactIds: string[]
  createdAt: number
  lastSequence: number
  lastSequenceDate: string
}

interface ContactStore {
  contacts: Contact[]
  groups: ContactGroup[]
  addContact: (name: string, sharedSecret: string) => Contact
  removeContact: (id: string) => void
  renameContact: (id: string, newName: string) => void
  getContact: (id: string) => Contact | undefined
  deriveNextRoom: (contactId: string) => { roomCode: string; sequence: number } | null
  createPairing: () => string
  addGroup: (name: string, contactIds: string[]) => ContactGroup
  removeGroup: (id: string) => void
  deriveGroupRoom: (groupId: string) => { roomCode: string; sequence: number } | null
}

export const useContactStore = create<ContactStore>()(
  persist(
    (set, get) => ({
      contacts: [],
      groups: [],

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
        set((s) => ({
          contacts: s.contacts.filter((c) => c.id !== id),
          groups: s.groups.filter((g) => !g.contactIds.includes(id)),
        }))
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
        const sequence = contact.lastSequenceDate === today ? contact.lastSequence : 0
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

      addGroup: (name: string, contactIds: string[]) => {
        const group: ContactGroup = {
          id: generatePeerId(),
          name,
          contactIds,
          createdAt: Date.now(),
          lastSequence: 0,
          lastSequenceDate: "",
        }
        set((s) => ({ groups: [...s.groups, group] }))
        return group
      },

      removeGroup: (id: string) => {
        set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
      },

      deriveGroupRoom: (groupId: string) => {
        const state = get()
        const group = state.groups.find((g) => g.id === groupId)
        if (!group) return null

        const secrets = group.contactIds
          .map((cid) => state.contacts.find((c) => c.id === cid)?.sharedSecret)
          .filter(Boolean) as string[]

        if (secrets.length < 2) return null

        const today = getTodayUTC()
        const sequence = group.lastSequenceDate === today ? group.lastSequence : 0
        const roomCode = deriveGroupRoomCode(secrets, today, sequence)

        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId
              ? { ...g, lastSequence: sequence + 1, lastSequenceDate: today }
              : g
          ),
        }))

        return { roomCode, sequence }
      },
    }),
    {
      name: "true-contacts",
    }
  )
)
