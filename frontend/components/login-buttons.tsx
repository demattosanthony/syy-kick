"use client";

import Link from "next/link";
import { Button } from "./ui/button";

export default function LoginButtons() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/login">
        <Button>Login</Button>
      </Link>
      <Link href="/login">
        <Button variant="secondary">Sign up</Button>
      </Link>
    </div>
  );
}
