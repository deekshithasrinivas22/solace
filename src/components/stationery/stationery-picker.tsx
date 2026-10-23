"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { Minus, Plus, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import {
  decorationCatalog,
  decorationCategoryLabels,
  paperTextureCatalog,
  tapeCatalog,
} from "@/lib/stationery/assets";
import {
  decorationIdValues,
  paperTextureValues,
  tapeStyleValues,
  type DecorationCategory,
  type DecorationId,
  type PaperTextureId,
  type PlacedDecoration,
  type PlacedDecorationTarget,
  type TapeStyleId,
} from "@/types/stationery";
import {
  addPlacedDecoration,
  deletePlacedDecoration,
  migrateLegacyDecorations,
  subscribeToPlacedDecorations,
  updatePlacedDecoration,
} from "@/lib/firebase/decorations";

const decorationCategories = Object.keys(decorationCategoryLabels) as DecorationCategory[];

export function StationeryPicker({
  textureId,
  tapeId,
  onTextureChange,
  onTapeChange,
  onAddDecoration,
  pendingDecorationId = null,
  onCancelPlacement,
  disabled = false,
  showPaper = true,
  showTape = true,
  openDecorations = false,
}: {
  textureId: PaperTextureId;
  tapeId: TapeStyleId;
  onTextureChange: (value: PaperTextureId) => void;
  onTapeChange: (value: TapeStyleId) => void;
  onAddDecoration: (value: DecorationId) => void;
  pendingDecorationId?: DecorationId | null;
  onCancelPlacement?: () => void;
  disabled?: boolean;
  showPaper?: boolean;
  showTape?: boolean;
  openDecorations?: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<DecorationCategory>("botanical");
  const [decorationsOpen, setDecorationsOpen] = useState(openDecorations);
  const availableDecorations = decorationIdValues.filter((id) => decorationCatalog[id].category === activeCategory);

  return (
    <div className="stationery-picker">
      {showPaper && <details className="stationery-picker-foldout">
        <summary>Paper · {paperTextureCatalog[textureId].label}</summary>
        <fieldset className="stationery-picker-section">
        <legend className="sr-only">Choose your paper</legend>
        <div className="stationery-paper-options" role="group" aria-label="Paper texture">
          {paperTextureValues.map((id) => {
            const asset = paperTextureCatalog[id];
            return (
              <button
                aria-pressed={textureId === id}
                className={`stationery-paper-option${textureId === id ? " selected" : ""}`}
                key={id}
                onClick={() => onTextureChange(id)}
                title={asset.label}
                type="button"
              >
                <Image alt="" aria-hidden="true" height={58} src={asset.src} width={78} />
                <span>{asset.label}</span>
              </button>
            );
          })}
        </div>
        </fieldset>
      </details>}

      {showTape && <details className="stationery-picker-foldout">
        <summary>Tape · {tapeId === "none" ? "None" : tapeCatalog[tapeId].label}</summary>
        <fieldset className="stationery-picker-section">
        <legend className="sr-only">Washi tape</legend>
        <div className="stationery-tape-options" role="group" aria-label="Washi tape style">
          {tapeStyleValues.map((id) => {
            const asset = id === "none" ? null : tapeCatalog[id];
            return (
              <button
                aria-pressed={tapeId === id}
                aria-label={asset?.label ?? "No tape"}
                className={`stationery-tape-option${tapeId === id ? " selected" : ""}${id === "none" ? " no-tape" : ""}`}
                key={id}
                onClick={() => onTapeChange(id)}
                title={asset?.label ?? "No tape"}
                type="button"
              >
                {asset ? <Image alt="" aria-hidden="true" height={42} src={asset.src} width={76} /> : <span aria-hidden="true">None</span>}
              </button>
            );
          })}
        </div>
        </fieldset>
      </details>}

      <details className="stationery-picker-foldout stationery-decoration-foldout" onToggle={(event) => setDecorationsOpen(event.currentTarget.open)} open={decorationsOpen}>
        <summary>Add keepsakes <small>Unlimited · place anywhere</small></summary>
        <fieldset className="stationery-picker-section">
        <legend className="sr-only">Little keepsakes. Add as many as you like.</legend>
        <div className="stationery-category-tabs" role="group" aria-label="Keepsake collection">
          {decorationCategories.map((category) => (
            <button
              aria-pressed={activeCategory === category}
              className={activeCategory === category ? "active" : ""}
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {decorationCategoryLabels[category]}
            </button>
          ))}
        </div>
        <div className="stationery-decoration-options" role="group" aria-label={decorationCategoryLabels[activeCategory]}>
          {availableDecorations.map((id) => {
            const asset = decorationCatalog[id];
            return (
              <button
                aria-label={`${pendingDecorationId === id ? "Selected" : "Choose"} ${asset.label} to place on the page`}
                aria-pressed={pendingDecorationId === id}
                className={`stationery-decoration-option${pendingDecorationId === id ? " selected" : ""}`}
                disabled={disabled}
                key={id}
                onClick={() => onAddDecoration(id)}
                title={asset.label}
                type="button"
              >
                <Image alt="" aria-hidden="true" height={68} src={asset.src} width={76} />
                <span>{asset.label}</span>
                <small>{pendingDecorationId === id ? "Place it" : "Choose"}</small>
              </button>
            );
          })}
        </div>
        <p className="stationery-picker-note">{disabled ? "Save this page first to add movable keepsakes." : pendingDecorationId ? "Now click or tap the exact spot on your page. You can move it again later." : "Choose a keepsake, then click the exact spot on your page. Add as many as you want."}</p>
        {pendingDecorationId && !disabled && onCancelPlacement && <button className="stationery-cancel-placement" onClick={onCancelPlacement} type="button">Cancel placement</button>}
        </fieldset>
      </details>
    </div>
  );
}

export function StationeryDecorationLayer({
  textureId,
  tapeId,
  className = "",
}: {
  textureId: PaperTextureId;
  tapeId: TapeStyleId;
  className?: string;
}) {
  const tape = tapeId === "none" ? null : tapeCatalog[tapeId];

  return (
    <div aria-hidden="true" className={`stationery-decoration-layer ${className}`}>
      <Image
        alt=""
        className={`stationery-background-image stationery-background-${textureId}`}
        height={1000}
        src={paperTextureCatalog[textureId].src}
        width={1400}
      />
      {tape && <Image alt="" className="stationery-tape-image" height={80} src={tape.src} width={240} />}
    </div>
  );
}

type PositionPatch = Pick<PlacedDecoration, "x" | "y">;

function keepInsidePage(value: number, size: number) {
  const margin = Math.min(size / 2, 49);
  return Math.max(margin, Math.min(100 - margin, value));
}

export function StationeryPageDecorations({
  target,
  legacyDecorationIds = [],
  disabled = false,
  pendingAssetId = null,
  onPlaced,
  onCancelPlacement,
}: {
  target: PlacedDecorationTarget | null;
  legacyDecorationIds?: DecorationId[];
  disabled?: boolean;
  pendingAssetId?: DecorationId | null;
  onPlaced?: () => void;
  onCancelPlacement?: () => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [decorations, setDecorations] = useState<PlacedDecoration[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const dragging = useRef<{ id: string; pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const placing = useRef(false);
  const targetKind = target?.kind;
  const scrapbookId = target?.kind === "scrapbook-page" ? target.scrapbookId : undefined;
  const pageId = target?.kind === "scrapbook-page" ? target.pageId : undefined;
  const entryId = target?.kind === "journal-entry" ? target.entryId : undefined;
  const stableTarget = useMemo<PlacedDecorationTarget | null>(() => {
    if (targetKind === "scrapbook-page" && scrapbookId && pageId) {
      return { kind: targetKind, scrapbookId, pageId };
    }
    if (targetKind === "journal-entry" && entryId) {
      return { kind: targetKind, entryId };
    }
    return null;
  }, [entryId, pageId, scrapbookId, targetKind]);

  useEffect(() => {
    if (!stableTarget) return;
    return subscribeToPlacedDecorations(
      stableTarget,
      (items) => {
        setDecorations(items);
        setLoaded(true);
        setSelectedId((current) => current && items.some((item) => item.id === current) ? current : null);
      },
      (loadError) => {
        console.error("Solace keepsakes failed to load:", loadError);
        setError("The page keepsakes couldn’t open. Refresh the page and try again.");
        setLoaded(true);
      },
    );
  }, [stableTarget]);

  useEffect(() => {
    if (!stableTarget || !loaded || decorations.length || !legacyDecorationIds.length) return;
    void migrateLegacyDecorations(stableTarget, legacyDecorationIds).catch((migrationError: unknown) => {
      console.error("Solace saved keepsakes could not be moved to the new layout:", migrationError);
      setError("Some older keepsakes couldn’t be arranged yet. Refresh and try again.");
    });
  }, [decorations.length, legacyDecorationIds, loaded, stableTarget]);

  const legacyOnly = decorations.length === 0 && legacyDecorationIds.length > 0;
  const visibleDecorations = legacyOnly
    ? legacyDecorationIds.map((assetId, index) => ({
      id: "legacy-preview-" + String(index),
      assetId,
      x: Math.max(10, 78 - index * 22),
      y: 24 + index * 22,
      size: 16,
      rotation: index % 2 === 0 ? -4 : 4,
      zIndex: index + 1,
      createdAt: null,
      updatedAt: null,
    }))
    : decorations;

  function pointOnLayer(clientX: number, clientY: number): PositionPatch | null {
    const bounds = layerRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    return {
      x: ((clientX - bounds.left) / bounds.width) * 100,
      y: ((clientY - bounds.top) / bounds.height) * 100,
    };
  }

  async function placeDecoration(clientX: number, clientY: number) {
    if (!stableTarget || !pendingAssetId || disabled || placing.current) return;
    const point = pointOnLayer(clientX, clientY);
    if (!point) return;
    placing.current = true;
    const placement = {
      x: keepInsidePage(point.x, 16),
      y: keepInsidePage(point.y, 16),
      size: 16,
      rotation: 0,
      zIndex: Math.min(2000000000, decorations.reduce((highest, item) => Math.max(highest, item.zIndex), 0) + 1),
    };
    try {
      const id = await addPlacedDecoration(stableTarget, pendingAssetId, placement);
      setSelectedId(id);
      setError("");
      onPlaced?.();
    } catch (placementError) {
      console.error("Solace keepsake could not be placed:", placementError);
      setError("That keepsake couldn’t be placed. Try again.");
    } finally {
      placing.current = false;
    }
  }

  function moveDecoration(event: PointerEvent<HTMLButtonElement>, item: PlacedDecoration) {
    const drag = dragging.current;
    if (drag?.id !== item.id || drag.pointerId !== event.pointerId) return;
    const point = pointOnLayer(event.clientX, event.clientY);
    if (!point) return;
    const position = {
      x: keepInsidePage(point.x + drag.offsetX, item.size),
      y: keepInsidePage(point.y + drag.offsetY, item.size),
    };
    setDecorations((current) => current.map((decoration) => decoration.id === item.id ? { ...decoration, ...position } : decoration));
  }

  async function saveDecoration(item: PlacedDecoration) {
    if (!stableTarget) return;
    try {
      await updatePlacedDecoration(stableTarget, item.id, {
        x: item.x,
        y: item.y,
        size: item.size,
        rotation: item.rotation,
        zIndex: item.zIndex,
      });
      setError("");
    } catch (saveError) {
      console.error("Solace keepsake placement could not be saved:", saveError);
      setError("That keepsake’s new spot couldn’t be saved. Try again.");
    }
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>, item: PlacedDecoration) {
    const drag = dragging.current;
    if (drag?.id !== item.id || drag.pointerId !== event.pointerId) return;
    dragging.current = null;
    const point = pointOnLayer(event.clientX, event.clientY);
    const position = point ? {
      x: keepInsidePage(point.x + drag.offsetX, item.size),
      y: keepInsidePage(point.y + drag.offsetY, item.size),
    } : null;
    const moved = position ? { ...item, ...position } : item;
    setDecorations((current) => current.map((decoration) => decoration.id === item.id ? moved : decoration));
    void saveDecoration(moved);
  }

  async function changeDecoration(item: PlacedDecoration, patch: Partial<PlacedDecoration>) {
    const updated = { ...item, ...patch };
    if (patch.size !== undefined) {
      updated.x = keepInsidePage(item.x, updated.size);
      updated.y = keepInsidePage(item.y, updated.size);
    }
    setDecorations((current) => current.map((decoration) => decoration.id === item.id ? updated : decoration));
    await saveDecoration(updated);
  }

  async function removeDecoration(item: PlacedDecoration) {
    if (!stableTarget) return;
    setDecorations((current) => current.filter((decoration) => decoration.id !== item.id));
    setSelectedId(null);
    try {
      await deletePlacedDecoration(stableTarget, item.id);
      setError("");
    } catch (deleteError) {
      console.error("Solace keepsake could not be removed:", deleteError);
      setError("That keepsake couldn’t be removed. Try again.");
    }
  }

  return (
    <>
      <div
        aria-label={pendingAssetId ? "Click the page to place the selected keepsake" : "Movable page keepsakes"}
        className={`stationery-placed-layer${pendingAssetId && !disabled ? " is-placement-mode" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape" && pendingAssetId) {
            event.preventDefault();
            onCancelPlacement?.();
          } else if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget && pendingAssetId) {
            event.preventDefault();
            const bounds = layerRef.current?.getBoundingClientRect();
            if (bounds) void placeDecoration(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
          }
        }}
        onPointerDown={(event) => {
          if (!pendingAssetId || disabled || event.target !== event.currentTarget) return;
          event.preventDefault();
          void placeDecoration(event.clientX, event.clientY);
        }}
        ref={layerRef}
        tabIndex={pendingAssetId && !disabled ? 0 : -1}
      >
        {visibleDecorations.map((item) => {
          const asset = decorationCatalog[item.assetId];
          const selected = selectedId === item.id;
          const itemDisabled = disabled || legacyOnly;
          return (
            <div
              className={"stationery-placed-item" + (selected ? " selected" : "")}
              key={item.id}
              style={{ left: String(item.x) + "%", top: String(item.y) + "%", width: String(item.size) + "%", zIndex: item.zIndex }}
            >
              <button
                aria-label={asset.label + ", movable decoration. Use arrow keys to reposition."}
                aria-pressed={selected}
                className="stationery-placed-handle"
                disabled={itemDisabled}
                onClick={() => setSelectedId(item.id)}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 5 : 1;
                  const positions: Record<string, PositionPatch> = {
                    ArrowLeft: { x: keepInsidePage(item.x - step, item.size), y: item.y },
                    ArrowRight: { x: keepInsidePage(item.x + step, item.size), y: item.y },
                    ArrowUp: { x: item.x, y: keepInsidePage(item.y - step, item.size) },
                    ArrowDown: { x: item.x, y: keepInsidePage(item.y + step, item.size) },
                  };
                  const position = positions[event.key];
                  if (!position) return;
                  event.preventDefault();
                  event.stopPropagation();
                  void changeDecoration(item, position);
                }}
                onPointerCancel={(event) => finishDrag(event, item)}
                onPointerDown={(event) => {
                  if (itemDisabled) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedId(item.id);
                  const point = pointOnLayer(event.clientX, event.clientY);
                  dragging.current = {
                    id: item.id,
                    pointerId: event.pointerId,
                    offsetX: point ? item.x - point.x : 0,
                    offsetY: point ? item.y - point.y : 0,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => moveDecoration(event, item)}
                onPointerUp={(event) => finishDrag(event, item)}
                style={{ transform: "translate(-50%, -50%) rotate(" + String(item.rotation) + "deg)" }}
                type="button"
              >
                <Image alt="" aria-hidden="true" draggable={false} height={500} src={asset.src} width={500} />
              </button>
              {selected && !itemDisabled && (
                <div aria-label={asset.label + " controls"} className="stationery-placed-controls" onPointerDown={(event) => event.stopPropagation()}>
                  <button aria-label="Make smaller" onClick={() => void changeDecoration(item, { size: Math.max(7, item.size - 2) })} type="button"><Minus size={12} /></button>
                  <button aria-label="Make larger" onClick={() => void changeDecoration(item, { size: Math.min(34, item.size + 2) })} type="button"><Plus size={12} /></button>
                  <button aria-label="Rotate left" onClick={() => void changeDecoration(item, { rotation: Math.max(-45, item.rotation - 5) })} type="button"><RotateCcw size={12} /></button>
                  <button aria-label="Rotate right" onClick={() => void changeDecoration(item, { rotation: Math.min(45, item.rotation + 5) })} type="button"><RotateCw size={12} /></button>
                  <button aria-label={"Remove " + asset.label} onClick={() => void removeDecoration(item)} type="button"><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <span aria-live="polite" className="stationery-decoration-error">{error}</span>}
    </>
  );
}
