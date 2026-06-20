"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import { Field } from "@/components/form-field"
import { createClient } from "@/lib/supabase/client"
import { signIn, type SignInState } from "../actions"

// Reasons the /auth/callback or /auth/confirm routes bounce back to /login.
const URL_ERRORS: Record<string, string> = {
  no_account: "No Lawfficient account for that Google address. Ask your firm admin to invite you first.",
  oauth_failed: "Google sign-in didn't complete. Please try again.",
  account_inactive: "Your account isn't active. Contact your firm administrator.",
  link_invalid: "That link is invalid or has expired.",
}

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  )
}

function LoginForm() {
  const [state, formAction, pending] = React.useActionState<SignInState, FormData>(signIn, null)
  const urlError = URL_ERRORS[useSearchParams().get("error") ?? ""]

  function signInWithGoogle() {
    const supabase = createClient()
    void supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back — sign in to your firm workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        {urlError ? (
          <p className="text-destructive mb-4 text-sm" role="alert">
            {urlError}
          </p>
        ) : null}
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required placeholder="you@firm.com" />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" required placeholder="••••••••" />
          </Field>
          {state?.error ? (
            <p className="text-destructive text-sm" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox id="remember" name="remember" defaultChecked />
              <Label htmlFor="remember" className="text-sm font-normal">
                Remember me
              </Label>
            </div>
            <Link href="/forgot-password" className="text-primary text-sm hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="border-border w-full border-t" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-card text-muted-foreground px-2 text-xs">or</span>
          </div>
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
          <GoogleIcon /> Continue with Google
        </Button>

        <p className="text-muted-foreground mt-4 text-center text-xs">
          Two-factor authentication is optional and can be enabled in Settings.
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense>
      <LoginForm />
    </React.Suspense>
  )
}
