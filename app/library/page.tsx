"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** My library 已与 Profile History 合并，重定向到 Profile */
export default function LibraryPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return null;
}
