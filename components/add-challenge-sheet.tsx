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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface Question {
  label: string
  type: "boolean" | "number" | "textarea"
}

interface AddChallengeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function AddChallengeSheet({
  open,
  onOpenChange,
  onCreated
}: AddChallengeSheetProps) {
  const [title, setTitle] = useState("")
  const [keyword, setKeyword] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)

  const isDirty = title !== "" || keyword !== "" || questions.length > 0

  const resetForm = () => {
    setTitle("")
    setKeyword("")
    setQuestions([])
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isDirty) {
      setShowDiscardDialog(true)
      return
    }
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleDiscard = () => {
    setShowDiscardDialog(false)
    resetForm()
    onOpenChange(false)
  }

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { label: "", type: "boolean" }])
  }

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...updates } : q))
    )
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const moveQuestion = (index: number, direction: "up" | "down") => {
    setQuestions((prev) => {
      const next = [...prev]
      const target = direction === "up" ? index - 1 : index + 1
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    const trimmedKeyword = keyword.trim().toUpperCase()

    if (!trimmedTitle) {
      toast.error("Title is required")
      return
    }
    if (!trimmedKeyword) {
      toast.error("Keyword is required")
      return
    }

    for (const q of questions) {
      if (!q.label.trim()) {
        toast.error("All questions must have a label")
        return
      }
    }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("challenges").insert({
      title: trimmedTitle,
      keyword: trimmedKeyword,
      questions: questions.map((q) => ({ ...q, label: q.label.trim() }))
    })
    setSaving(false)

    if (error) {
      if (error.code === "23505") {
        toast.error("A challenge with this keyword already exists")
      } else {
        toast.error("Failed to create challenge")
      }
      return
    }

    toast.success("Challenge created")
    resetForm()
    onOpenChange(false)
    onCreated()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Add Challenge</SheetTitle>
            <SheetDescription>
              Configure a new challenge with a title, keyword, and judge
              questions.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-2">
              <Label htmlFor="challenge-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="challenge-title"
                placeholder="Best AI Hack"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="challenge-keyword">
                Keyword <span className="text-destructive">*</span>
              </Label>
              <Input
                id="challenge-keyword"
                placeholder="BEST_AI"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-muted-foreground">
                Must match exactly what appears in submission prize strings.
                Auto-uppercased.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Questions</Label>
              {questions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No questions added yet.
                </p>
              )}
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex shrink-0 flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-6 text-muted-foreground"
                        onClick={() => moveQuestion(i, "up")}
                        disabled={i === 0}
                        tabIndex={-1}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-6 text-muted-foreground"
                        onClick={() => moveQuestion(i, "down")}
                        disabled={i === questions.length - 1}
                        tabIndex={-1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Question label"
                      value={q.label}
                      onChange={(e) =>
                        updateQuestion(i, { label: e.target.value })
                      }
                      className="flex-1"
                    />
                    <Select
                      value={q.type}
                      onValueChange={(val) =>
                        updateQuestion(i, {
                          type: val as Question["type"]
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="textarea">Textarea</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addQuestion}
                className="w-full"
              >
                Add Question
              </Button>
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
