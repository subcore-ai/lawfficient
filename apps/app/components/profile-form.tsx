"use client"

import * as React from "react"
import { Mail } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
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
import { initialsOf } from "@/lib/format"
import {
  changeMyPassword,
  removeMyAvatar,
  updateMyAvatar,
  updateMyName,
} from "@/app/(app)/profile/actions"

export function ProfileSettings({
  name,
  email,
  role,
  pod,
  editable,
  googleConnected,
  avatarUrl,
}: {
  name: string
  email: string
  role: Role
  pod: string | null
  editable: boolean
  googleConnected: boolean
  avatarUrl: string | null
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-6">
        <ProfileCard
          name={name}
          email={email}
          role={role}
          pod={pod}
          editable={editable}
          googleConnected={googleConnected}
        />
        {editable ? <PasswordCard /> : null}
      </div>
      <AvatarCard name={name} avatarUrl={avatarUrl} editable={editable} />
    </div>
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

const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"]
const AVATAR_MAX_BYTES = 4 * 1024 * 1024

function AvatarCard({
  name,
  avatarUrl,
  editable,
}: {
  name: string
  avatarUrl: string | null
  editable: boolean
}) {
  const [pending, startTransition] = React.useTransition()
  // Local object-URL for instant feedback while the upload is in flight; the
  // server's revalidated avatarUrl takes over once the action resolves.
  const [preview, setPreview] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // let the same file be re-picked after an error
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPG, or WEBP image.")
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("That image is larger than 4 MB.")
      return
    }
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    const fd = new FormData()
    fd.append("avatar", file)
    startTransition(async () => {
      const res = await updateMyAvatar(fd)
      URL.revokeObjectURL(localUrl)
      setPreview(null)
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Photo updated")
    })
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeMyAvatar()
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Photo removed")
    })
  }

  const shown = preview ?? avatarUrl

  return (
    <Card className="lg:self-start">
      <CardHeader>
        <CardTitle>Photo</CardTitle>
        <CardDescription>Shown on your profile and in the top bar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Avatar className="size-28">
          {shown ? <AvatarImage src={shown} alt="" /> : null}
          <AvatarFallback className="text-2xl">{initialsOf(name)}</AvatarFallback>
        </Avatar>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onPick}
          disabled={!editable || pending}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!editable || pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {avatarUrl ? (
            <Button variant="ghost" size="sm" disabled={pending} onClick={onRemove}>
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-center text-xs">PNG, JPG, or WEBP. Up to 4 MB.</p>
      </CardContent>
    </Card>
  )
}
