"use client";

import { useEffect, useRef } from "react";
import { localTodayISO } from "@/lib/dates";

/** An uncontrolled date input that defaults to today on this device (the server's today is UTC). */
export function LocalDateInput({ id, name, className = "field", required }: { id: string; name: string; className?: string; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // set as the default too, so a form reset comes back to today
    if (ref.current && !ref.current.value) ref.current.defaultValue = ref.current.value = localTodayISO();
  }, []);
  return <input ref={ref} id={id} name={name} type="date" className={className} required={required} />;
}
