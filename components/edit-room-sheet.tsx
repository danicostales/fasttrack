"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { Plus, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { PrizeBadge } from "./prize-badge"

interface Judge {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

interface ChallengeOption {
  id: string
  title: string
  keyword: string
}

export interface Room {
  id: string
  name: string
  judges: Judge[]
  challenges: { id: string; title: string; keyword: string }[]
}

interface EditRoomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: Room
  onUpdated: () => void
}

export function EditRoomSheet({
  open,
  onOpenChange,
  room,
  onUpdated
}: EditRoomSheetProps) {
  const [name, setName] = useState(room.name)
  const [judges, setJudges] = useState<Judge[]>(room.judges)
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>(
    room.challenges.map((c) => c.id)
  )
  const [saving, setSaving] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  // Judge search
  const [judgeSearch, setJudgeSearch] = useState("")
  const [judgeResults, setJudgeResults] = useState<Judge[]>([])

  // Challenge options
  const [challengeOptions, setChallengeOptions] = useState<ChallengeOption[]>(
    []
  )

  const isDirty = (() => {
    if (name !== room.name) return true
    const origJudgeIds = room.judges.map((j) => j.id).sort()
    const currJudgeIds = judges.map((j) => j.id).sort()
    if (JSON.stringify(origJudgeIds) !== JSON.stringify(currJudgeIds))
      return true
    const origChallengeIds = room.challenges.map((c) => c.id).sort()
    const currChallengeIds = [...selectedChallengeIds].sort()
    if (JSON.stringify(origChallengeIds) !== JSON.stringify(currChallengeIds))
      return true
    return false
  })()

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setShowDiscardDialog(true)
      return
    }
    onOpenChange(nextOpen)
  }

  const handleDiscard = () => {
    setShowDiscardDialog(false)
    setName(room.name)
    setJudges(room.judges)
    setSelectedChallengeIds(room.challenges.map((c) => c.id))
    setJudgeSearch("")
    setJudgeResults([])
    onOpenChange(false)
  }

  // Fetch challenges on mount
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from("challenges")
      .select("id, title, keyword")
      .order("title")
      .then(({ data }) => {
        setChallengeOptions(data || [])
      })
  }, [open])

  // Debounced judge search
  const searchJudges = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setJudgeResults([])
      return
    }
    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("role", "judge")
      .or(
        `email.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`
      )
      .limit(10)

    setJudgeResults(data || [])
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchJudges(judgeSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [judgeSearch, searchJudges])

  const addJudge = (judge: Judge) => {
    if (judges.some((j) => j.id === judge.id)) return
    setJudges((prev) => [...prev, judge])
    setJudgeSearch("")
    setJudgeResults([])
  }

  const removeJudge = (id: string) => {
    setJudges((prev) => prev.filter((j) => j.id !== id))
  }

  const toggleChallenge = (id: string) => {
    setSelectedChallengeIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error("Room name is required")
      return
    }

    setSaving(true)
    const supabase = createClient()

    // Update room name
    const { error: roomError } = await supabase
      .from("rooms")
      .update({ name: trimmedName })
      .eq("id", room.id)

    if (roomError) {
      setSaving(false)
      toast.error("Failed to update room")
      return
    }

    // Sync judges: delete all then re-insert
    const { error: deleteJudgesError } = await supabase
      .from("room_judges")
      .delete()
      .eq("room_id", room.id)

    if (deleteJudgesError) {
      setSaving(false)
      toast.error("Failed to update judges")
      return
    }

    if (judges.length > 0) {
      const { error: insertJudgesError } = await supabase
        .from("room_judges")
        .insert(judges.map((j) => ({ room_id: room.id, judge_id: j.id })))

      if (insertJudgesError) {
        setSaving(false)
        toast.error("Room updated but failed to assign judges")
        onOpenChange(false)
        onUpdated()
        return
      }
    }

    // Sync challenges: delete all then re-insert
    const { error: deleteChallengesError } = await supabase
      .from("room_challenges")
      .delete()
      .eq("room_id", room.id)

    if (deleteChallengesError) {
      setSaving(false)
      toast.error("Failed to update challenges")
      return
    }

    if (selectedChallengeIds.length > 0) {
      const { error: insertChallengesError } = await supabase
        .from("room_challenges")
        .insert(
          selectedChallengeIds.map((cid) => ({
            room_id: room.id,
            challenge_id: cid
          }))
        )

      if (insertChallengesError) {
        setSaving(false)
        toast.error("Room updated but failed to assign challenges")
        onOpenChange(false)
        onUpdated()
        return
      }
    }

    setSaving(false)
    toast.success("Room updated")
    onOpenChange(false)
    onUpdated()
  }

  const filteredJudgeResults = judgeResults.filter(
    (r) => !judges.some((j) => j.id === r.id)
  )

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit Room</SheetTitle>
            <SheetDescription>
              Update room details, judges, and challenges.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 px-4 pb-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-room-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-room-name"
                placeholder="Room A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Judges */}
            <div className="space-y-2">
              <Label>Judges</Label>

              {judges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {judges.map((judge) => (
                    <div
                      key={judge.id}
                      className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                    >
                      <span>
                        {[judge.first_name, judge.last_name]
                          .filter(Boolean)
                          .join(" ") || judge.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeJudge(judge.id)}
                        className="rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Input
                placeholder="Search judges by name or email..."
                value={judgeSearch}
                onChange={(e) => setJudgeSearch(e.target.value)}
              />

              {filteredJudgeResults.length > 0 && (
                <div className="rounded-md border">
                  {filteredJudgeResults.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                      onClick={() => addJudge(j)}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {[j.first_name, j.last_name]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {j.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Challenges */}
            <div className="space-y-2">
              <Label>Challenges</Label>
              {challengeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No configured challenges found.
                </p>
              ) : (
                <div className="space-y-1 rounded-md border p-2">
                  {challengeOptions.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`edit-room-challenge-${c.id}`}
                        checked={selectedChallengeIds.includes(c.id)}
                        onCheckedChange={() => toggleChallenge(c.id)}
                      />
                      <label
                        htmlFor={`edit-room-challenge-${c.id}`}
                        className="flex flex-1 cursor-pointer items-center gap-2 text-sm"
                      >
                        <span>{c.title}</span>
                        <PrizeBadge prize={c.keyword} />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
