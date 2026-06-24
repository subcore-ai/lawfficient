import { docs } from "collections/server"
import { loader } from "fumadocs-core/source"

// The content source for the docs tree — generated from `content/docs` by the fumadocs-mdx
// Next plugin (see next.config.mjs) into `.source`, aliased as `collections/*` in tsconfig.
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
})
