import { useId, useState } from "react";
import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Accessible name for the tablist. */
  label: string;
  defaultTabId?: string;
}

export function Tabs({ tabs, label, defaultTabId }: TabsProps) {
  const base = useId();
  const [active, setActive] = useState(defaultTabId ?? tabs[0]?.id);

  return (
    <div className="sot-tabs">
      <div className="sot-tabs__list" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${base}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className="sot-tabs__tab"
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${base}-panel-${tab.id}`}
          aria-labelledby={`${base}-tab-${tab.id}`}
          className="sot-tabs__panel"
          hidden={tab.id !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
