import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  FilePlus2,
  FileUp,
  History,
  LayoutGrid,
  ShieldCheck,
  SquarePen,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"

export type Role = "admin" | "examiner" | "candidate"
export type NavItem = { href: string; label: string; icon: LucideIcon; match?: (path: string) => boolean; keywords?: string }
export type NavGroup = { label: string; items: NavItem[] }
export type Command = { label: string; href: string; icon: LucideIcon; hint?: string; keywords?: string }

export const ROLE_LABEL: Record<Role, string> = { admin: "Administration", examiner: "Examiner desk", candidate: "Candidate" }

export const NAV: Record<Role, NavGroup[]> = {
  admin: [
    {
      label: "Platform",
      items: [
        { href: "/admin/overview", label: "Overview", icon: BarChart3, keywords: "dashboard stats" },
        { href: "/admin", label: "Users and roles", icon: Users, match: (p) => p === "/admin", keywords: "accounts people" },
        { href: "/admin/audit", label: "Audit log", icon: History, keywords: "history ledger" },
      ],
    },
  ],
  examiner: [
    {
      label: "Examinations",
      items: [
        { href: "/examiner", label: "All exams", icon: LayoutGrid, match: (p) => p === "/examiner" || p.startsWith("/examiner/exams"), keywords: "board" },
        { href: "/examiner/bank", label: "Question bank", icon: BookOpenCheck, keywords: "questions" },
        { href: "/examiner/imports", label: "Bulk import", icon: FileUp, keywords: "csv json upload" },
      ],
    },
  ],
  candidate: [
    {
      label: "My work",
      items: [{ href: "/candidate", label: "My exams", icon: ClipboardList, match: (p) => p === "/candidate" || p.startsWith("/candidate/"), keywords: "results" }],
    },
  ],
}

export const COMMANDS: Record<Role, Command[]> = {
  admin: [
    { label: "Create an account", href: "/admin?new=1", icon: UserPlus, keywords: "user add" },
    { label: "Verify a report code", href: "/verify", icon: ShieldCheck, keywords: "qr certificate" },
  ],
  examiner: [
    { label: "Create an exam", href: "/examiner/exams/new", icon: FilePlus2, keywords: "new paper" },
    { label: "Write a question", href: "/examiner/bank/new", icon: SquarePen, keywords: "new item" },
    { label: "Import candidates or questions", href: "/examiner/imports", icon: FileUp, keywords: "csv" },
    { label: "Verify a report code", href: "/verify", icon: ShieldCheck, keywords: "qr" },
  ],
  candidate: [{ label: "Verify a report code", href: "/verify", icon: ShieldCheck, keywords: "qr" }],
}

/** Readable breadcrumb labels for known path segments. Ids collapse into their parent's label. */
const SEGMENT: Record<string, string> = {
  admin: "Administration",
  overview: "Overview",
  audit: "Audit log",
  examiner: "Exams",
  exams: "",
  bank: "Question bank",
  new: "New",
  imports: "Bulk import",
  questions: "Questions",
  candidates: "Candidates",
  review: "Review and publish",
  results: "Grading and results",
  analytics: "Analytics",
  candidate: "My exams",
}

export function crumbs(pathname: string): { label: string; href: string }[] {
  const parts = pathname.split("/").filter(Boolean)
  const out: { label: string; href: string }[] = []
  let href = ""
  const candidate = parts[0] === "candidate"
  parts.forEach((p, i) => {
    href += `/${p}`
    const isId = /^[0-9a-f-]{16,}$/i.test(p)
    // Candidate routes: /candidate/results/<id> reads "My exams > Result", /candidate/exams/<id> reads "My exams > Exam".
    if (candidate && (p === "results" || p === "exams")) return
    if (candidate && isId) {
      out.push({ label: parts[i - 1] === "results" ? "Result" : "Exam", href })
      return
    }
    const label = isId ? (parts[i - 1] === "exams" ? "Exam" : parts[i - 1] === "results" ? "Attempt" : parts[i - 1] === "bank" ? "Question" : "Detail") : SEGMENT[p]
    if (label) out.push({ label, href })
  })
  return out
}
