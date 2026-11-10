import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { DeskApp } from "@/components/desk/desk-app";
import { startDesk } from "@/lib/deriv-engine";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  useEffect(() => {
    startDesk();
  }, []);

  return <DeskApp />;
}
