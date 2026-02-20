import { Separator } from "@/components/ui/separator"

export default function OrSeparator() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <Separator className="w-full" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background text-muted-foreground px-2">Or</span>
      </div>
    </div>
  )
}
