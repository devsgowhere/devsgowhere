import { readFileSync } from 'fs';
import yaml from "js-yaml";

const FRONTMATTER_REGEX = /^---\r?\n|\r?\n---\r?\n/

export function parseFrontmatter(path: string): unknown {
  const content = readFileSync(path, { encoding: 'utf8' });
  const frontmatter = content.split(FRONTMATTER_REGEX).at(1)
  if (!frontmatter) {
    throw new Error(`Frontmatter not found in file: ${path}`)
  }
  let result: unknown
  try {
    result = yaml.load(frontmatter)
  } catch (error) {
    throw new Error("Error while parsing frontmatter", { cause: error })
  }
  return result 
}
