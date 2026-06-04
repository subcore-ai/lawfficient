"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

export default function LoginPage() {
  const router = useRouter()

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push("/")
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Welcome back — sign in to your firm workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" required placeholder="you@firm.com" defaultValue="sofia@chidolulaw.com" />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" type="password" required placeholder="••••••••" defaultValue="demo-password" />
          </Field>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox id="remember" defaultChecked />
              <Label htmlFor="remember" className="text-sm font-normal">
                Remember me
              </Label>
            </div>
            <Link href="/forgot-password" className="text-primary text-sm hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            Two-factor authentication is optional and can be enabled in Settings.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
