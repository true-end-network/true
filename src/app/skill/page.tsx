import { readFileSync } from "fs"
import { join } from "path"
import { SkillContent } from "./skill-content"

export default function SkillPage() {
  const filePath = join(process.cwd(), "public", "SKILL.md")
  const content = readFileSync(filePath, "utf-8")

  return <SkillContent content={content} />
}
