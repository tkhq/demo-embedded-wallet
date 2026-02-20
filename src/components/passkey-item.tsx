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
    <div className="border-border bg-card flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center space-x-4">
        <div className="shrink-0">
          <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full sm:h-10 sm:w-10">
            <Key className="text-primary h-3 w-3 sm:h-5 sm:w-5" />
          </div>
        </div>
        <div>
          <h3 className="text-card-foreground text-xs font-medium sm:text-sm">
            {name}
          </h3>
          <span className="text-muted-foreground text-xs sm:hidden">
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
        <span className="text-muted-foreground hidden text-xs sm:block">
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
              className="text-destructive focus:text-destructive cursor-pointer"
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
