import { createFromSource } from "fumadocs-core/search/server"

import { source } from "@/lib/source"

// Static search index (Orama) built from the docs source; the RootProvider wires the UI.
export const { GET } = createFromSource(source)
