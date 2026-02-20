"use client"

export const dynamic = "force-dynamic"

import noSSR from "next/dynamic"
import { Loader } from "lucide-react"

import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/icons"

const FacebookProcessCallback = noSSR(
  () =>
    import("./facebook-callback-content").then(
      (m) => m.FacebookProcessCallback
    ),
  {
    ssr: false,
    loading: () => (
      <main className="flex w-full flex-col items-center justify-center">
        <Card className="mx-auto h-full w-full sm:w-1/2">
          <CardHeader className="space-y-4">
            <Icons.turnkey className="h-12 w-full stroke-0 py-2 sm:h-14 dark:stroke-white" />
            <CardTitle className="flex items-center justify-center text-center">
              <div className="flex items-center gap-2">
                <Loader className="text-muted-foreground h-4 w-4 animate-spin" />
                <span className="text-base">Redirecting...</span>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </main>
    ),
  }
)

export default function Facebook() {
  return <FacebookProcessCallback />
}
