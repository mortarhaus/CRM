"use client";

import { type Hsv, hsvToHex } from "@crm/core/branding";
import type { KeyboardEvent, PointerEvent } from "react";
import { cn } from "@/lib/utils";

// A small drag picker (plan Task 6; no dependency, Q6): a saturation/brightness area and a hue slider, both
// role="slider" and operable with the arrow keys, Page Up/Down and Home/End. It is a progressive enhancement of the hex
// field and is rendered only with JavaScript, so its style props are applied through the CSSOM (allowed by the page
// CSP), never as a server-rendered style attribute.

const SMALL_STEP = 1;
const LARGE_STEP = 10;
const HUE_MAX = 359;

const clamp = (value: number, max: number) => Math.round(Math.min(max, Math.max(0, value)));

const FOCUS =
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
// White with a dark edge, so the thumb shows on every colour beneath it.
const THUMB =
  "pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.7)]";

// The change one key makes along an axis, or null for a key the slider does not use.
function keyDelta(event: KeyboardEvent, increase: string[], decrease: string[]): number | null {
  const step = event.shiftKey ? LARGE_STEP : SMALL_STEP;
  if (increase.includes(event.key)) return step;
  if (decrease.includes(event.key)) return -step;
  return null;
}

// Where the pointer is inside the element, as fractions 0..1 from the left and from the top.
function pointerFraction(event: PointerEvent<HTMLElement>): { x: number; y: number } {
  const box = event.currentTarget.getBoundingClientRect();
  return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
}

function startDrag(event: PointerEvent<HTMLElement>, apply: (event: PointerEvent<HTMLElement>) => void) {
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.focus();
  apply(event);
}

export function ColourPicker({ value, onChange }: { value: Hsv; onChange: (next: Hsv) => void }) {
  const { h, s, v } = value;

  const fromArea = (event: PointerEvent<HTMLElement>) => {
    const { x, y } = pointerFraction(event);
    onChange({ h, s: clamp(x * 100, 100), v: clamp((1 - y) * 100, 100) });
  };
  const fromHue = (event: PointerEvent<HTMLElement>) => onChange({ h: clamp(pointerFraction(event).x * HUE_MAX, HUE_MAX), s, v });

  function onAreaKey(event: KeyboardEvent) {
    const saturation = keyDelta(event, ["ArrowRight"], ["ArrowLeft"]);
    const brightness = keyDelta(event, ["ArrowUp"], ["ArrowDown"]);
    const page = event.key === "PageUp" ? LARGE_STEP : event.key === "PageDown" ? -LARGE_STEP : null;
    const edge = event.key === "Home" ? 0 : event.key === "End" ? 100 : null;
    if (saturation === null && brightness === null && page === null && edge === null) return;
    event.preventDefault();
    onChange({
      h,
      s: edge ?? clamp(s + (saturation ?? 0), 100),
      v: clamp(v + (brightness ?? 0) + (page ?? 0), 100),
    });
  }

  function onHueKey(event: KeyboardEvent) {
    const delta = keyDelta(event, ["ArrowRight", "ArrowUp"], ["ArrowLeft", "ArrowDown"]);
    const page = event.key === "PageUp" ? LARGE_STEP : event.key === "PageDown" ? -LARGE_STEP : null;
    const edge = event.key === "Home" ? 0 : event.key === "End" ? HUE_MAX : null;
    if (delta === null && page === null && edge === null) return;
    event.preventDefault();
    onChange({ h: edge ?? clamp(h + (delta ?? 0) + (page ?? 0), HUE_MAX), s, v });
  }

  return (
    <fieldset className="flex max-w-xs flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">Pick a colour</legend>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={s}
        aria-valuetext={`Saturation ${s}%, brightness ${v}%`}
        aria-describedby="colour-picker-keys"
        onPointerDown={(event) => startDrag(event, fromArea)}
        onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && fromArea(event)}
        onKeyDown={onAreaKey}
        style={{ backgroundColor: hsvToHex({ h, s: 100, v: 100 }) }}
        className={cn("relative aspect-[3/2] w-full cursor-crosshair touch-none rounded-lg", FOCUS)}
      >
        {/* Saturation runs from white on the left; brightness falls to black at the bottom. */}
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-linear-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-linear-to-t from-black to-transparent" />
        <span className={THUMB} style={{ left: `${s}%`, top: `${100 - v}%`, backgroundColor: hsvToHex(value) }} />
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={HUE_MAX}
        aria-valuenow={h}
        aria-valuetext={`Hue ${h} degrees`}
        onPointerDown={(event) => startDrag(event, fromHue)}
        onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && fromHue(event)}
        onKeyDown={onHueKey}
        // The hue wheel's six primaries and secondaries: the scale itself, not a design token.
        className={cn(
          "relative h-6 w-full cursor-pointer touch-none rounded-full bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]",
          FOCUS,
        )}
      >
        <span className={cn(THUMB, "top-1/2")} style={{ left: `${(h / HUE_MAX) * 100}%`, backgroundColor: hsvToHex({ h, s: 100, v: 100 }) }} />
      </div>
      <p id="colour-picker-keys" className="text-sm text-muted-foreground">
        Arrow keys: left and right change saturation, up and down change brightness. Hold Shift for larger steps.
      </p>
    </fieldset>
  );
}
