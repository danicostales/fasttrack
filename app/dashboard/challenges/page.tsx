"use client"

import { AddChallengeSheet } from "@/components/add-challenge-sheet"
import {
  Challenge,
  EditChallengeSheet
} from "@/components/edit-challenge-sheet"
import { PrizeBadge } from "@/components/prize-badge"
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
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import {
  FolderOpen,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users
} from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

interface Submission {
  id: string
  number: number
  title: string | null
  prizes: string[]
  submission_participants: {
    participant_id: string
  }[]
}

interface ConfiguredChallenge extends Challenge {
  projectCount: number
  participantCount: number
}

interface DetectedPrize {
  name: string
  projectCount: number
  participantCount: number
}

export default function ChallengesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(
    null
  )
  const [deletingChallenge, setDeletingChallenge] = useState<Challenge | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchAll = useRef(async () => {
    const supabase = createClient()
    const [submissionsResult, challengesResult, userResult] = await Promise.all(
      [
        supabase
          .from("submissions")
          .select(
            "id, number, title, prizes, submission_participants(participant_id)"
          ),
        supabase.from("challenges").select("*").order("title"),
        supabase.auth.getUser()
      ]
    )

    if (submissionsResult.error) {
      toast.error("Failed to fetch submissions")
      console.error(submissionsResult.error)
    } else {
      setSubmissions((submissionsResult.data as unknown as Submission[]) || [])
    }

    if (challengesResult.error) {
      toast.error("Failed to fetch challenges")
      console.error(challengesResult.error)
    } else {
      setChallenges((challengesResult.data as unknown as Challenge[]) || [])
    }

    if (!userResult.error && userResult.data.user) {
      const profileResult = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userResult.data.user.id)
        .single()
      if (!profileResult.error) {
        setIsAdmin(profileResult.data?.role === "admin")
      }
    }

    setLoading(false)
  })

  useEffect(() => {
    fetchAll.current()
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAll.current()
    setIsRefreshing(false)
  }

  const handleDelete = async () => {
    if (!deletingChallenge) return
    setIsDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("challenges")
      .delete()
      .eq("id", deletingChallenge.id)
    setIsDeleting(false)

    if (error) {
      toast.error("Failed to delete challenge")
      console.error(error)
      return
    }

    toast.success("Challenge deleted")
    setDeletingChallenge(null)
    await fetchAll.current()
  }

  const { configuredChallenges, detectedPrizes } = useMemo(() => {
    const challengeMap = new Map<
      string,
      { projectCount: number; participantIds: Set<string> }
    >()

    submissions.forEach((s) => {
      const participantIds = s.submission_participants.map(
        (sp) => sp.participant_id
      )
      s.prizes.forEach((prize) => {
        if (!challengeMap.has(prize)) {
          challengeMap.set(prize, {
            projectCount: 0,
            participantIds: new Set()
          })
        }
        const info = challengeMap.get(prize)!
        info.projectCount++
        participantIds.forEach((pid) => info.participantIds.add(pid))
      })
    })

    const configuredKeywords = new Set(challenges.map((c) => c.keyword))

    const configured: ConfiguredChallenge[] = challenges.map((c) => {
      const stats = challengeMap.get(c.keyword)
      return {
        ...c,
        projectCount: stats?.projectCount ?? 0,
        participantCount: stats?.participantIds.size ?? 0
      }
    })

    const detected: DetectedPrize[] = Array.from(challengeMap.entries())
      .filter(([name]) => !configuredKeywords.has(name))
      .map(([name, info]) => ({
        name,
        projectCount: info.projectCount,
        participantCount: info.participantIds.size
      }))
      .sort((a, b) => {
        if (a.name === "GENERAL") return -1
        if (b.name === "GENERAL") return 1
        return a.name.localeCompare(b.name)
      })

    return { configuredChallenges: configured, detectedPrizes: detected }
  }, [submissions, challenges])

  const totalCount = configuredChallenges.length + detectedPrizes.length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="whitespace-nowrap text-sm text-muted-foreground">
          {totalCount} {totalCount === 1 ? "challenge" : "challenges"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh challenges"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setAddSheetOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Challenge
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="shadow-none">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {configuredChallenges.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Configured</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {configuredChallenges.map((challenge) => (
                  <Card key={challenge.id} className="shadow-none">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-medium">
                              {challenge.title}
                            </p>
                            <PrizeBadge prize={challenge.keyword} />
                          </div>
                          {isAdmin && (
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => setEditingChallenge(challenge)}
                                title="Edit challenge"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeletingChallenge(challenge)}
                                title="Delete challenge"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <ListChecks className="h-3.5 w-3.5" />
                            {challenge.questions.length}{" "}
                            {challenge.questions.length === 1
                              ? "question"
                              : "questions"}
                          </span>
                          <Link
                            href={`/dashboard/challenges/${encodeURIComponent(challenge.keyword)}`}
                            className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            {challenge.projectCount}{" "}
                            {challenge.projectCount === 1
                              ? "project"
                              : "projects"}
                          </Link>
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <Users className="h-3.5 w-3.5" />
                            {challenge.participantCount}{" "}
                            {challenge.participantCount === 1
                              ? "participant"
                              : "participants"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {detectedPrizes.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Detected</h3>
                <p className="text-xs text-muted-foreground">
                  Prizes found in submissions without a configured challenge
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {detectedPrizes.map((prize) => (
                  <Link
                    key={prize.name}
                    href={`/dashboard/challenges/${encodeURIComponent(prize.name)}`}
                  >
                    <Card className="shadow-none transition-colors hover:bg-muted/50">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <PrizeBadge prize={prize.name} />
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <FolderOpen className="h-3.5 w-3.5" />
                              {prize.projectCount}{" "}
                              {prize.projectCount === 1
                                ? "project"
                                : "projects"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {prize.participantCount}{" "}
                              {prize.participantCount === 1
                                ? "participant"
                                : "participants"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {configuredChallenges.length === 0 && detectedPrizes.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No challenges found
            </div>
          )}
        </div>
      )}

      <AddChallengeSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        onCreated={handleRefresh}
      />

      {editingChallenge && (
        <EditChallengeSheet
          open={!!editingChallenge}
          onOpenChange={(open) => {
            if (!open) setEditingChallenge(null)
          }}
          challenge={editingChallenge}
          onUpdated={handleRefresh}
        />
      )}

      <AlertDialog
        open={!!deletingChallenge}
        onOpenChange={(open) => {
          if (!open) setDeletingChallenge(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete challenge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingChallenge?.title}
              &quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
