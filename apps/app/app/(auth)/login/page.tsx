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
import { GoogleIcon } from "@/components/google-icon"
import { createClient } from "@/lib/supabase/client"
import { signIn, type SignInState } from "../actions"

// Reasons the /auth/callback or /auth/confirm routes bounce back to /login.
const URL_ERRORS: Record<string, string> = {
  no_account: "No Lawfficient account for that Google address. Ask your firm admin to invite you first.",
  oauth_failed: "Google sign-in didn't complete. Please try again.",
  account_inactive: "Your account isn't active. Contact your firm administrator.",
  link_invalid: "That link is invalid or has expired.",
}

function LoginForm() {
  const [state, formAction, pending] = React.useActionState<SignInState, FormData>(signIn, null)
  const urlError = URL_ERRORS[useSearchParams().get("error") ?? ""]

  async function signInWithGoogle() {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    // signInWithOAuth normally redirects the browser away; an error here means it
    // didn't (provider disabled, missing creds, network) — surface it rather than
    // appear to do nothing.
    if (error) {
      window.location.assign("/login?error=oauth_failed")
    }
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
