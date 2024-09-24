import { ReactNode } from "react"

interface FeatureProps {
  title: string
  icon: ReactNode
  children: ReactNode
}

export default function Feature({ title, icon, children }: FeatureProps) {
  return (
    <div className="grid grid-cols-[1fr,8fr] items-start">
      <div className="mt-[3px]">{icon}</div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold leading-none">{title}</h2>
        <div>{children}</div>
      </div>
    </div>
  )
}
