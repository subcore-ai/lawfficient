import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

// Shared nav/branding for both the home and docs layouts.
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Lawfficient API",
    },
    githubUrl: "https://github.com/subcore-ai/lawfficient",
  }
}
