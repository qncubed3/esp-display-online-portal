"use client";

import { useState, type ReactNode } from "react";
import { Code2, Cpu, Shapes } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";

type TabId = "data" | "draw" | "devices";

// Panels stay mounted (just hidden) so unsaved edits survive switching tabs.
export default function ServiceTabs({ data, draw, devices }: { data: ReactNode; draw: ReactNode; devices: ReactNode }) {
  const [tab, setTab] = useState<TabId>("data");
  const panels: Record<TabId, ReactNode> = { data, draw, devices };

  return (
    <div>
      <Tabs
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: "data", label: <><Code2 size={14} /> Data</> },
          { id: "draw", label: <><Shapes size={14} /> Draw</> },
          { id: "devices", label: <><Cpu size={14} /> Devices</> },
        ]}
      />
      {(Object.keys(panels) as TabId[]).map((id) => (
        <div key={id} role="tabpanel" hidden={id !== tab} className="pt-5">
          {panels[id]}
        </div>
      ))}
    </div>
  );
}
