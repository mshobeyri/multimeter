export type ExampleTier = 'basic' | 'intermediate' | 'professional'

export type ExampleFile = {
  path: string
  content: string
}

export type ExampleEntry = {
  tier: ExampleTier
  slug: string
  title: string
  description: string
  files: ExampleFile[]
}
