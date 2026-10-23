"use client";

import Image from "next/image";
import { coverArtworkCatalog } from "@/lib/stationery/assets";
import { scrapbookCoverArtworkValues, type ScrapbookCoverArtwork } from "@/types/stationery";

export function ScrapbookCoverArtPicker({
  value,
  onChange,
}: {
  value: ScrapbookCoverArtwork;
  onChange: (value: ScrapbookCoverArtwork) => void;
}) {
  return (
    <fieldset className="scrapbook-cover-art-picker">
      <legend>Cover photograph <small>Choose the little picture on your cover</small></legend>
      <div className="scrapbook-cover-art-options">
        {scrapbookCoverArtworkValues.map((id) => {
          const artwork = coverArtworkCatalog[id];
          return (
            <button
              aria-label={artwork.label}
              aria-pressed={value === id}
              className={`scrapbook-cover-art-option${value === id ? " selected" : ""}`}
              key={id}
              onClick={() => onChange(id)}
              type="button"
            >
              <Image alt="" aria-hidden="true" height={76} src={artwork.src} width={78} />
              <span>{artwork.label}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
