import fs from "fs/promises";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface DeleteSkillPayload {
  filePath?: string;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
}

function getAllowedSkillRoots(): string[] {
  const home = os.homedir();
  const cwd = process.cwd();
  return [
    path.join(home, ".claude", "skills"),
    path.join(home, ".codex", "skills"),
    path.join(cwd, ".claude", "skills"),
    path.join(cwd, ".codex", "skills"),
  ];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DeleteSkillPayload | null;
  const rawFilePath = body?.filePath;

  if (!rawFilePath || typeof rawFilePath !== "string") {
    return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
  }

  const resolvedFilePath = path.resolve(rawFilePath);
  const allowedRoots = getAllowedSkillRoots();
  if (!allowedRoots.some((root) => isInside(root, resolvedFilePath))) {
    return NextResponse.json({ error: "Path is not deletable" }, { status: 403 });
  }

  if (path.basename(resolvedFilePath).toLowerCase() !== "skill.md") {
    return NextResponse.json({ error: "Only SKILL.md files can be deleted" }, { status: 400 });
  }

  const skillDir = path.dirname(resolvedFilePath);
  const skillDirName = path.basename(skillDir);
  if (skillDirName.startsWith(".")) {
    return NextResponse.json({ error: "System skills cannot be deleted" }, { status: 403 });
  }

  const stat = await fs.stat(skillDir).catch(() => null);
  if (!stat?.isDirectory()) {
    return NextResponse.json({ error: "Skill directory not found" }, { status: 404 });
  }

  await fs.rm(skillDir, { recursive: true, force: true });
  return NextResponse.json({ ok: true, deletedPath: skillDir });
}

