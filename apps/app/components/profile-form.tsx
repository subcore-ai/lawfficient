"use client"

import * as React from "react"
import { Mail } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

import { Field } from "@/components/form-field"
import { GoogleIcon } from "@/components/google-icon"
import { StatusPill } from "@/components/status-pill"
import { ROLE_LABELS } from "@/data"
import type { Role } from "@/data/types"
import { changeMyPassword, updateMyName } from "@/app/(app)/profile/actions"

export function ProfileSettings({
  name,
  email,
  role,
  pod,
  editable,
  googleConnected,
}: {
  name: string
  email: string
  role: Role
  pod: string | null
  editable: boolean
  googleConnected: boolean
}) {
  return (
    <>
      <ProfileCard
        name={name}
        email={email}
        role={role}
        pod={pod}
        editable={editable}
        googleConnected={googleConnected}
      />
      {editable ? <PasswordCard /> : null}
    </>
  )
}

function ProfileCard({
  name,
  email,
  role,
  pod,
  editable,
  googleConnected,
}: {
  name: string
  email: string
  role: Role
  pod: string | null
  editable: boolean
  googleConnected: boolean
}) {
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateMyName(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      if (res.changed) {
        toast.success("Profile saved", { description: "Your display name was updated." })
      } else {
        toast.info("No changes to save")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your display name and account details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Display name">
            <Input
              name="name"
              defaultValue={name}
              required
              maxLength={100}
              disabled={!editable || pending}
            />
          </Field>
          <Field label="Email">
            {/* Email changes are admin-only + re-verified — not editable here. */}
            <Input defaultValue={email} disabled />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role">
              <Input defaultValue={ROLE_LABELS[role]} disabled />
            </Field>
            <Field label="Pod">
              <Input defaultValue={pod ?? "Not assigned"} disabled />
            </Field>
          </div>
          <Field label="Sign-in methods">
            <div className="flex flex-col gap-2.5 rounded-md border px-3 py-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="text-muted-foreground size-4 shrink-0" />
                <span>Email &amp; password</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <GoogleIcon className="size-4 shrink-0" />
                <span>Google</span>
                <StatusPill
                  label={googleConnected ? "Connected" : "Not connected"}
                  tone={googleConnected ? "success" : "neutral"}
                  className="ml-auto"
                />
              </div>
            </div>
          </Field>
          {editable ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Connect Supabase to edit your profile.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const [pending, startTransition] = React.useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    if (fd.get("password") !== fd.get("confirm")) {
      toast.error("Those passwords don't match.")
      return
    }
    startTransition(async () => {
      const res = await changeMyPassword(fd)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Password changed", {
        description: "Use your new password the next time you sign in.",
      })
      form.reset()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Change the password you use to sign in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="New password">
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={pending}
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              disabled={pending}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
