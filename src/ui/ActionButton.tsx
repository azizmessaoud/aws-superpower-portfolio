import type { ButtonHTMLAttributes } from "react";
import Icon from "./Icon";

/* One state model for the portfolio's action buttons (FE-AA1).
 *
 *   idle ──click──▶ loading ──▶ success ──(timer, owned by the caller)──▶ idle
 *                      └──────▶ error   ──(timer or next action)────────▶ idle
 *   disabled: not available right now (for example another lookup is in flight)
 *
 * Hover, keyboard focus and pressed are CSS (:hover, :focus-visible, :active) so they never wait on React.
 * Every state differs by icon and label as well as colour, so none relies on colour alone.
 * The button uses aria-disabled, not `disabled`: it keeps keyboard focus while busy, and a screen-reader
 * user is told it is busy instead of losing it. Clicks are swallowed while loading or disabled, so a
 * double click cannot start two actions. The caller owns the state; this component only presents it. */
export type ActionState = "idle" | "loading" | "success" | "error" | "disabled";
type IconName = Parameters<typeof Icon>[0]["name"];

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  state?: ActionState;
  variant?: "primary" | "ghost" | "chip";
  /** Label for the idle and disabled states. */
  label: string;
  /** Labels for the other states; each falls back to `label`. */
  labels?: Partial<Record<"loading" | "success" | "error", string>>;
  icon?: IconName;
  /** Extra class for layout only (width, margins). */
  layout?: string;
}

const STATE_ICON: Partial<Record<ActionState, IconName>> = { loading: "busy", success: "check", error: "alert" };

export default function ActionButton({ state = "idle", variant = "primary", label, labels, icon, layout, onClick, type = "button", ...rest }: Props) {
  const inert = state === "loading" || state === "disabled";
  const shown = state === "loading" || state === "success" || state === "error" ? labels?.[state] ?? label : label;
  const glyph = STATE_ICON[state] ?? icon;
  const base = variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "suggest-q";
  return (
    <button
      {...rest}
      type={type}
      className={`${base} act${layout ? ` ${layout}` : ""}`}
      data-state={state}
      aria-disabled={inert || undefined}
      aria-busy={state === "loading" || undefined}
      onClick={(e) => { if (inert) { e.preventDefault(); return; } onClick?.(e); }}
    >
      {glyph && <Icon name={glyph} />}
      <span>{shown}</span>
    </button>
  );
}
