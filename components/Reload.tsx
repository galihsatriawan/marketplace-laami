"use client";

export function Reload({ label }: { label: string }) {
  return <button type="button" className="btn pri" style={{ marginTop: 8 }} onClick={() => location.reload()}>{label}</button>;
}
