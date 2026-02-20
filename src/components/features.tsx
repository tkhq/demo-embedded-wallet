import Link from "next/link"
import { CheckCircle, GitFork, ShieldCheck } from "lucide-react"

import { Icons } from "@/components/icons"

import Feature from "../components/feature"

export default function Features() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-16 px-24 text-white">
      <Feature title="Non-custodial" icon={<CheckCircle />}>
        Only you can access your private keys.
      </Feature>

      <Feature
        title="Passwordless"
        icon={<Icons.passwordLess className="-mt-1 h-7 w-7" />}
      >
        <p className="text-white">
          No need to remember a password or seed phrase. Authentication methods
          include email, passkeys,{" "}
          <Link
            target="_blank"
            className="text-white underline underline-offset-4"
            href="https://docs.turnkey.com/passkeys/introduction"
          >
            and more
          </Link>
          .
        </p>
      </Feature>
      <Feature title="Secure" icon={<ShieldCheck />}>
        Scalable, institutional-grade security. View our security documentation{" "}
        <Link
          target="_blank"
          className="text-white underline underline-offset-4"
          href="https://docs.turnkey.com/category/security"
        >
          here
        </Link>
        .
      </Feature>

      <Feature title="Open-source" icon={<GitFork />}>
        Curious about how this is built? Dive into the code on{" "}
        <Link
          target="_blank"
          className="text-white underline underline-offset-4"
          href="https://github.com/tkhq/demo-embedded-wallet"
        >
          Github
        </Link>
        .
      </Feature>
    </div>
  )
}
