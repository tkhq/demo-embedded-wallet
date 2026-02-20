import Link from "next/link"

import { Button } from "./ui/button"

export default function Legal() {
  return (
    <div className="text-muted-foreground py-4 text-center text-xs">
      By continuing, you agree to{" "}
      <Button
        variant="link"
        className="text-secondary-foreground h-min p-0 text-xs"
      >
        <Link target="_blank" href="https://www.turnkey.com/legal/terms">
          Terms & Conditions
        </Link>
      </Button>{" "}
      and{" "}
      <Button
        variant="link"
        className="text-secondary-foreground h-min p-0 text-xs"
      >
        <Link target="_blank" href="https://www.turnkey.com/legal/privacy">
          Privacy Policy
        </Link>
      </Button>
    </div>
  )
}
