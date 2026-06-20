"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

import { Field } from "@/components/form-field"
import { activateAccount, type ActivateState } from "./actions"

export default function SetPasswordPage() {
  const [state, formAction, pending] = React.useActionState<ActivateState, FormData>(
    activateAccount,
    null,
  )

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Set your password</CardTitle>
        <CardDescription>Choose a password to activate your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="New password" htmlFor="password">
            <Input id="password" name="password" type="password" required minLength={8} placeholder="••••••••" />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" required minLength={8} placeholder="••••••••" />
          </Field>
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Activating…" : "Activate account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
