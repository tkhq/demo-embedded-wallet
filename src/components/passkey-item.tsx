import { Key, MoreVertical } from "lucide-react"

import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

interface PasskeyItemProps {
  name: string
  createdAt: Date
  onRemove: () => void
  isRemovable: boolean
}

export function PasskeyItem({
  name,
  createdAt,
  onRemove,
  isRemovable,
}: PasskeyItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 sm:h-10 sm:w-10">
            <Key className="h-3 w-3 text-primary sm:h-5 sm:w-5" />
          </div>
        </div>
        <div>
          <h3 className=" text-xs font-medium text-card-foreground sm:text-sm">
            {name}
          </h3>
          <span className="text-xs text-muted-foreground sm:hidden">
            Created at{" "}
            {createdAt.toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
      <div className="flex items-center sm:space-x-4">
        <span className="hidden text-xs text-muted-foreground sm:block">
          Created at{" "}
          {createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          })}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={onRemove}
              disabled={!isRemovable}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
