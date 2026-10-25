"use client";

import { Check } from "lucide-react";
import { solaceThemeOptions, useSolaceTheme } from "@/components/providers/theme-provider";

export function ThemePicker() {
  const { theme, setTheme } = useSolaceTheme();

  return (
    <div className="theme-picker" role="group" aria-label="Choose a Solace theme">
      {solaceThemeOptions.map((option) => (
        <button
          aria-pressed={theme === option.id}
          className={"theme-choice" + (theme === option.id ? " selected" : "")}
          key={option.id}
          onClick={() => setTheme(option.id)}
          type="button"
        >
          <span className="theme-choice-swatches" aria-hidden="true">
            {option.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
          </span>
          <span className="theme-choice-copy">
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </span>
          {theme === option.id && <Check className="theme-choice-check" size={17} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
