"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, Pencil, Plus, Search, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Panel } from "@/components/shell/page-header"
import { NativeSelect, useAction } from "@/components/shell/common"
import { fmtDate } from "@/lib/format"
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateUserInput,
} from "@/lib/validation/users"
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions"

type Role = "admin" | "examiner" | "candidate"
type UserRow = { id: string; name: string; email: string; role: Role; active: boolean; createdAt: string }

const ROLE_BADGE: Record<Role, "brand" | "info" | "muted"> = { admin: "brand", examiner: "info", candidate: "muted" }
const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", examiner: "Examiner", candidate: "Candidate" }

function applyServerErrors<T extends Record<string, unknown>>(
  form: { setError: (name: never, e: { message: string }) => void },
  fields?: Record<string, string>
) {
  if (!fields) return
  for (const [k, message] of Object.entries(fields)) form.setError(k as never, { message })
  return {} as T
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { run, pending } = useAction()
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", role: "candidate", password: "" },
  })
  const e = form.formState.errors
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>Share the temporary password with the person securely. They can sign in right away.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            const r = await run(() => createUserAction(values))
            if (r.ok) {
              form.reset()
              onOpenChange(false)
            } else applyServerErrors(form, r.fields)
          })}
        >
          <FieldGroup>
            <Field data-invalid={!!e.name}>
              <FieldLabel htmlFor="cu-name">Full name</FieldLabel>
              <Input id="cu-name" aria-invalid={!!e.name} {...form.register("name")} />
              <FieldError errors={[e.name]} />
            </Field>
            <Field data-invalid={!!e.email}>
              <FieldLabel htmlFor="cu-email">Email</FieldLabel>
              <Input id="cu-email" type="email" autoComplete="off" aria-invalid={!!e.email} {...form.register("email")} />
              <FieldError errors={[e.email]} />
            </Field>
            <Field data-invalid={!!e.role}>
              <FieldLabel htmlFor="cu-role">Role</FieldLabel>
              <NativeSelect id="cu-role" {...form.register("role")}>
                <option value="candidate">Candidate</option>
                <option value="examiner">Examiner</option>
                <option value="admin">Administrator</option>
              </NativeSelect>
              <FieldError errors={[e.role]} />
            </Field>
            <Field data-invalid={!!e.password}>
              <FieldLabel htmlFor="cu-password">Temporary password</FieldLabel>
              <Input id="cu-password" type="text" autoComplete="new-password" aria-invalid={!!e.password} {...form.register("password")} />
              <FieldDescription>At least 8 characters with a letter and a number.</FieldDescription>
              <FieldError errors={[e.password]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({ user, self, onClose }: { user: UserRow; self: boolean; onClose: () => void }) {
  const { run, pending } = useAction()
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { id: user.id, name: user.name, role: user.role, active: user.active },
  })
  const e = form.formState.errors
  const active = form.watch("active")
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            const r = await run(() => updateUserAction(values))
            if (r.ok) onClose()
          })}
        >
          <FieldGroup>
            <Field data-invalid={!!e.name}>
              <FieldLabel htmlFor="eu-name">Full name</FieldLabel>
              <Input id="eu-name" aria-invalid={!!e.name} {...form.register("name")} />
              <FieldError errors={[e.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="eu-role">Role</FieldLabel>
              <NativeSelect id="eu-role" disabled={self} {...form.register("role")}>
                <option value="candidate">Candidate</option>
                <option value="examiner">Examiner</option>
                <option value="admin">Administrator</option>
              </NativeSelect>
              {self && <FieldDescription>You cannot change your own role.</FieldDescription>}
            </Field>
            <Field orientation="horizontal">
              <Switch
                id="eu-active"
                checked={active}
                disabled={self}
                onCheckedChange={(v) => form.setValue("active", v, { shouldDirty: true })}
              />
              <FieldLabel htmlFor="eu-active">Account active</FieldLabel>
            </Field>
            {!active && !self && (
              <p className="rounded-lg bg-warning-soft p-3 text-sm text-warning-text">
                Deactivating signs this person out everywhere and blocks future sign-ins. Their records are kept.
              </p>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { run, pending } = useAction()
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { id: user.id, password: "" } })
  const e = form.formState.errors
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a new temporary password for {user.name}. Existing sessions end immediately.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            const r = await run(() => resetPasswordAction(values), { refresh: false })
            if (r.ok) onClose()
          })}
        >
          <Field data-invalid={!!e.password}>
            <FieldLabel htmlFor="rp-password">New password</FieldLabel>
            <Input id="rp-password" type="text" autoComplete="new-password" aria-invalid={!!e.password} {...form.register("password")} />
            <FieldError errors={[e.password]} />
          </Field>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsersManager({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [q, setQ] = React.useState("")
  const [role, setRole] = React.useState<"" | Role>("")
  const [creating, setCreating] = React.useState(false)
  const [editing, setEditing] = React.useState<UserRow | null>(null)
  const [resetting, setResetting] = React.useState<UserRow | null>(null)

  const filtered = users.filter(
    (u) =>
      (!role || u.role === role) &&
      (!q || u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search users"
            placeholder="Search by name or email"
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <NativeSelect aria-label="Filter by role" className="sm:w-44" value={role} onChange={(e) => setRole(e.target.value as Role | "")}>
          <option value="">All roles</option>
          <option value="admin">Administrators</option>
          <option value="examiner">Examiners</option>
          <option value="candidate">Candidates</option>
        </NativeSelect>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          New account
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id} className={!u.active ? "opacity-60" : undefined}>
                <TableCell className="pl-5">
                  <p className="font-medium">
                    {u.name} {u.id === currentUserId && <span className="text-xs text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                </TableCell>
                <TableCell>
                  {u.active ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="warning">
                      <UserX aria-hidden />
                      Deactivated
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(u.createdAt)}</TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                      <Pencil />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setResetting(u)} aria-label={`Reset password for ${u.name}`}>
                      <KeyRound />
                      <span className="hidden sm:inline">Password</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No users match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CreateUserDialog open={creating} onOpenChange={setCreating} />
      {editing && <EditUserDialog user={editing} self={editing.id === currentUserId} onClose={() => setEditing(null)} />}
      {resetting && <ResetPasswordDialog user={resetting} onClose={() => setResetting(null)} />}
    </Panel>
  )
}
