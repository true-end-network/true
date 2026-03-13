import { create } from "zustand"
import { persist } from "zustand/middleware"
import { deriveScheduledRoomCode, generatePeerId } from "@/lib/crypto"

export interface ScheduledRoom {
  id: string
  contactId: string
  contactName: string
  sharedSecret: string
  date: string
  hour: number
  topic: string
  createdAt: number
}

interface ScheduleStore {
  schedules: ScheduledRoom[]
  addSchedule: (params: {
    contactId: string
    contactName: string
    sharedSecret: string
    date: string
    hour: number
    topic: string
  }) => ScheduledRoom
  removeSchedule: (id: string) => void
  deriveScheduleRoom: (id: string) => string | null
}

export const useScheduleStore = create<ScheduleStore>()(
  persist(
    (set, get) => ({
      schedules: [],

      addSchedule: (params) => {
        const schedule: ScheduledRoom = {
          id: generatePeerId(),
          ...params,
          createdAt: Date.now(),
        }
        set((s) => ({ schedules: [...s.schedules, schedule] }))
        return schedule
      },

      removeSchedule: (id: string) => {
        set((s) => ({ schedules: s.schedules.filter((s) => s.id !== id) }))
      },

      deriveScheduleRoom: (id: string) => {
        const schedule = get().schedules.find((s) => s.id === id)
        if (!schedule) return null
        return deriveScheduledRoomCode(schedule.sharedSecret, schedule.date, schedule.hour)
      },
    }),
    {
      name: "true-schedules",
    }
  )
)
